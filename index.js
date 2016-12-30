// Add a "copy as md" button to BibleGateway


/* helper functions
**************************************/

// Get elements by CSS selector:
function qs(selector, scope) {
	return (scope || document).querySelector(selector);
}
function qsa(selector, scope) {
	return (scope || document).querySelectorAll(selector);
}


// remove node
function removeNode(node) {
	return node.parentNode.removeChild(node);
}


// remove parent without removing childen
function unwrap(wrapper) {
	// place childNodes in document fragment
	var docFrag = document.createDocumentFragment();
	while (wrapper.firstChild) {
		var child = wrapper.removeChild(wrapper.firstChild);
		docFrag.appendChild(child);
	}

	// replace wrapper with document fragment
	wrapper.parentNode.replaceChild(docFrag, wrapper);
}


// Replace tag name but keep element contents
function changeTag(el, newTagName, keepAttributes) {
	var newEl = document.createElement(newTagName);

	// Copy the children
	while (el.firstChild) {
		newEl.appendChild(el.firstChild); // *Moves* the child
	}

	// Copy the attributes
	if (keepAttributes) {
		for (var i = el.attributes.length - 1; i >= 0; --i) {
			newEl.attributes.setNamedItem(el.attributes[i].cloneNode());
		}
	}

	// Replace it
	el.parentNode.replaceChild(newEl, el);
}



// check if element can have child nodes
var canHaveChildren = (function() {
	var noChildren = {
		input: 1,
		meta: 1,
		br: 1,
		link: 1,
		img: 1,
		hr: 1,
		area: 1,
		base: 1,
		col: 1,
		param: 1,
		wbr: 1,
		track: 1,
		source: 1,
		embed: 1,
		command: 1,
		keygen: 1
	};

	return function canHaveChildren(tagName) {
		tagName = tagName.toLowerCase();
		return !noChildren[tagName];
	};
})();


// get array of descendant nodes
function getDescendants(parent) {
	var all = [];
	for (parent = parent.firstChild; parent; parent = parent.nextSibling) {
		all.push(parent);
		if (
			parent.nodeType === Node.ELEMENT_NODE &&
			['SCRIPT','STYLE'].indexOf(parent.tagName) < 0
		) {
			all = all.concat(getDescendants(parent));
		}
	}
	return all;
}


// execute callback after passed script URLs have loaded
function loadScripts(urls, cb) {
	var numReady = 0;
	function count() {
		if (++numReady === urls.length) cb();
	}

	urls.forEach(function loadScript(url) {
		var s = document.createElement('script');
		s.src = url;
		s.defer = true;
		s.onload = count;
		document.body.appendChild(s);
	});
}


// pass a function-encased multi-line comment
// returns the multi-line string in the comment
function hereDoc(f) {
	return f.toString()
		.replace(/^[^\/]+\/\*!?/, '')
		.replace(/\*\/[^\/]+$/, '');
}

function embedStyle(fn) {
	// get CSS
	var css = hereDoc(fn);

	// create <style>
	var style = document.createElement('style');
	style.innerHTML = css;

	// append <style>
	document.head.appendChild(style);
}

function onDOMReady(callback) {
	if (
		document.readyState === 'complete' || 
		document.readyState === 'interactive'
	) {
		callback();
	} else {
		document.addEventListener("DOMContentLoaded", callback);
	}
}




/* app logic
**************************************/

onDOMReady(init);

function init() {
	// make sure we're on the right page
	var buttonParent = qs('.passage-options');
	if (!buttonParent) {
		console.log('Copy as markdown button won\'t work on this page.');
		return;
	}

	// create button
	buttonParent.appendChild(createButton());

	// button CSS will go in <style>
	embedStyle(function () {/*!
		.copy-as-markdown:before {
			content: 'md';
			line-height: 1em;
		}
	*/});


	// load scripts
	loadScripts([
		// html to markdown
		'https://rawgit.com/domchristie/to-markdown/master/dist/to-markdown.js',

		// clipboard.js
		'https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/1.5.16/clipboard.min.js'
	], function() {
		// copy on button click
		new Clipboard('.copy-as-markdown', {
			text: function(trigger) {
				return getMarkdown();
			}
		}).on('success', function() {
			console.log('markdown copied.');
		});

		console.timeEnd('Generate copy as markdown button');
	});

	function getMarkdown() {
		// clone passage container
		var textParent = qs('.text-html');
		var clone = textParent.cloneNode(true);

		// append as an invisible sibling
		clone.style.display = 'none';
		textParent.parentNode.appendChild(clone);


		// clean up markup in clone
		cleanChildren(clone);

		// join identical siblings
		var newMarkup = joinIdenticalSiblings(clone.innerHTML);

		// remove clone
		removeNode(clone);

		// convert html to markdown
		return toMarkdown(newMarkup);
	}
}

function createButton() {
	console.time('Generate copy as markdown button');
	var button = document.createElement('a');
	button.className = 'copy-as-markdown';
	button.title = 'Copy as Markdown';
	return button;
}

function joinIdenticalSiblings(markup) {
	return markup
		.split('</span> <span class="small-caps">')
		.join(' ')
		.split('</span><span class="small-caps">')
		.join('')
		.split('</i><i>')
		.join('')
		.split('</i> <i>')
		.join(' ');
}

function cleanChildren(passageContainer) {
	// clean up markup in clone
	getDescendants(passageContainer).forEach(function(descendant) {
		// remove comments
		if (descendant.nodeType === Node.COMMENT_NODE) {
			removeNode(descendant);
		}

		// do nothing to other non-elements
		if (descendant.nodeType !== Node.ELEMENT_NODE) {
			return;
		}

		// also remove:
		if (
			// passage reference heading
			descendant.classList.contains('passage-display') ||

			// chapter number spans
			descendant.classList.contains('chapternum') ||

			// elements that could but don't have child nodes
			(descendant.matches(':empty') && canHaveChildren(descendant.tagName)) ||

			// verse number spans
			descendant.classList.contains('versenum') ||

			// hidden elements
			getComputedStyle(descendant).display === 'none'
		) {
			removeNode(descendant);
		}

		// remove these elements but keep their contents:
		else if (
			// text spans
			descendant.classList.contains('text') ||

			// words of Jesus spans
			descendant.classList.contains('woj')
		) {
			unwrap(descendant);
		}

		// turn .poetry div into blockquote
		else if (descendant.classList.contains('poetry')) {
			changeTag(descendant, 'blockquote');
		}

		// remove "chapter-1" class
		descendant.classList.remove('chapter-1');

		// remove style attribute
		descendant.removeAttribute('style');

		// remove empty class attribute
		if (descendant.className === '') descendant.removeAttribute('class');
	});
}
