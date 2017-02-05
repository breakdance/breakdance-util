'use strict';

var url = require('url');
var typeOf = require('kind-of');
var get = require('get-value');
var type = require('typeof-article');
var isSelfClosing = require('is-self-closing');
var diacritics = require('diacritics-map');
var stripColor = require('strip-color');
var wordRegex = require('word-regex');
var util = require('snapdragon-util');

/**
 * Wrapper for creating the handlers for compiling a tag that has `*.open` and
 * `*.close` nodes, in a single function call.
 *
 * ```js
 * breakdance.set('div', utils.block('', ''));
 * breakdance.set('address', block('\n<address>\n', '\n</address>\n'));
 * // optionally pass a handler function to access the "parent" node
 * breakdance.set('abbr', block('<abbr>', '</abbr>', function(node) {
 *   var attr = utils.toAttribs(node.attribs, ['title']);
 *   if (attr) {
 *     node.open = '<abbr' + attr + '>';
 *   }
 * }))
 * ```
 * @param {String} `open` The opening tag to render
 * @param {String} `close` The closing tag to render
 * @param {Object} `state`
 * @param {Function} `handler` Visitor function to modify the node
 * @return {undefined}
 * @api public
 */

exports.block = function(open, close, handler) {
  return function(node, nodes, i) {
    if (util.isEmptyNodes(node, open)) return;
    var state = this.state;
    var type = node.type;
    var isVoid = isSelfClosing(node.type);

    if (!isVoid && !this.compilers.hasOwnProperty(type + '.open')) {
      this.set(type + '.open', util.noop);
      this.set(type + '.close', util.noop);
    }

    // convert headings to bold see: edge-cases.md - headings #1
    if (/^h[1-6]$/.test(type)) {
      if (util.isInside(state, node, ['a', 'li', 'table'])) {
        node.type = 'strong';
        open = '**';
        close = '**';
      }
    }

    if (typeof handler === 'function') {
      handler.call(this, node, nodes, i);

      // allow handler to override opening tag
      if (node.open) {
        open = node.open;
      }
    }

    if (!/^(sup|sub)$/.test(node.type) && /[a-z0-9]/i.test(this.output.slice(-1))) {
      this.emit(' ');
    }

    this.emit(open, node);
    this.mapVisit(node);
    this.emit(close, node);
  };
};

/**
 * Stringify the `attribs` for a node.
 *
 * ```js
 * var str = utils.toAttribs(node.attribs);
 * ```
 * @param {Object} `attribs` Object of attributes to stringify
 * @param {Array} `names` Array of `names` to only stringify attributes with those
 * names.
 * @return {String} Returns a string of attributes, e.g. `src="foo.jpg"`
 * @api public
 */

exports.toAttribs = function(attribs, names) {
  if (!attribs) return '';
  var attr = '';

  for (var key in attribs) {
    if (attribs.hasOwnProperty(key)) {
      if (names && names.indexOf(key) === -1) {
        continue;
      }

      var val = attribs[key];
      attr = ' ' + key;

      if (typeof val !== 'boolean') {
        attr += '="' + val.trim() + '"';
      }
    }
  }
  return attr;
};

/**
 * Attempt to get a "language" value from the given `attribs`.
 * Used with code/pre tags.
 *
 * ```js
 * breakdance.set('code', function(node) {
 *   var lang = utils.getLang(node.attribs);
 *   // console.log(lang);
 * });
 * ```
 * @param {Object} `attribs` The `node.attribs` object
 * @return {String}
 * @api public
 */

exports.getLang = function(attribs) {
  attribs = attribs || {};
  var lang = get(attribs, 'data-lang') || get(attribs, 'data-language') || '';
  var classLang = get(attribs, 'class') || '';

  var regex = /lang(?:uage)?-([^\s]+)/;
  var match = regex.exec(lang) || regex.exec(classLang);
  if (match) {
    return match[1];
  }

  return lang;
};

/**
 * Helper for handling spacing around emphasis tags.
 */

exports.emphasis = function(openTag) {
  return function(node) {
    if (this.options.whitespace === false) {
      return this.mapVisit(node);
    }

    if (util.isEmptyNodes(node, openTag)) return;
    if (/(^|\w)$/.test(this.output)) this.emit(' ');
    this.mapVisit(node);
  };
};

/**
 * Slugify the url part of a markdown link.
 *
 * ```js
 * var str = utils.toAttribs(node.attribs);
 * ```
 *
 * @param  {String} `str` The string to slugify
 * @param  {Object} `options` Pass a custom slugify function on `options.slugify`. As an implementor, this allows you to just pass the breakdance options as the second argument to allow users to override this function.
 * @return {String}
 * @api {public}
 */

exports.slugify = function(str, options) {
  options = options || {};
  if (options.slugify === false) return str;
  if (typeof options.slugify === 'function') {
    return options.slugify(str, options);
  }

  str = stripColor(str);
  str = str.toLowerCase();

  // `.split()` is often (but not always) faster than `.replace()`
  str = str.split(/ /).join('-');
  str = str.split(/\t/).join('--');
  str = str.split(/[|$&`~=\\\/@+*!?({[\]})<>=.,;:'"^]/).join('');
  str = str.split(/[。？！，、；：“”【】（）〔〕［］﹃﹄“ ”‘’﹁﹂—…－～《》〈〉「」]/).join('');

  str = replaceDiacritics(str);
  if (options.num) {
    str += '-' + options.num;
  }
  return str;
};

/**
 * Replace diacritics in the given string with english language
 * equivalents. This is necessary for slugifying headings to
 * be conformant with how github slugifies headings.
 */

function replaceDiacritics(str) {
  return str.replace(/[À-ž]/g, function(ch) {
    return diacritics[ch] || ch;
  });
}

/**
 * Formats the link part of a "src" or "href" attribute on the given `node`.
 *
 * ```js
 * // this is how <img> tags are rendered
 * breakdance.set('img', function(node) {
 *   var attribs = node.attribs || {};
 *   if (attribs.src) {
 *     this.emit('![' + (attribs.alt || '').trim());
 *     this.mapVisit(node);
 *     var src = utils.formatLink(node, 'src', this);
 *     this.emit(']' + src);
 *     //=> ![foo](bar.jpg)
 *   }
 * })
 * ```
 * @param {Object} `node`
 * @param {String} `key` Either `'src'` or `'href'`
 * @param {Object} `compiler` Pass the breakdance compiler instance, for state and options.
 * @return {String}
 * @api public
 */

exports.formatLink = function(node, key, compiler) {
  if (typeof key !== 'string') {
    throw new TypeError('expected key to be a string, got: ' + type(key));
  }

  var options = compiler.options;
  var state = compiler.state;
  var attribs = node.attribs || {};
  var link = (attribs[key] || '').trim();

  state.links[key] = state.links[key] || [];

  if (typeof options.url === 'function') {
    link = options.url(attribs, key, state);

  } else if (link && options.domain && !/(?:(?:^#)|(?::?\/\/))/.test(link)) {
    link = url.resolve(options.domain, link);

  } else if (link === '#' && state.title) {
    link = '#' + state.title;

  } else if (link.charAt(0) === '#') {
    link = link.split('_').join('-');
    link = '#' + exports.slugify(link.slice(1), options);
  }

  var text = '';
  if (attribs.title) {
    text = ' "' + attribs.title.trim() + '"';
  }

  if (link && options.reflinks && !/(^#|mailto:)/.test(link)) {
    var idx = state.links[key].indexOf(link);
    if (link && idx === -1) {
      state.links[key].push(link);
      idx = state.links[key].length - 1;
    }
    link = '[' + key.trim() + '-' + idx + ']';
  } else {
    link = '(' + link.trim() + text + ')';
  }

  return link;
};

/**
 * String utils
 */

exports.isWrappingChar = function(str) {
  return /[*_"'`]/.test(str);
};

exports.isStartingChar = function(str) {
  return /[$@#~]/.test(str) || exports.isOpeningChar(str);
};

exports.isOpeningChar = function(str) {
  return /[<([{]/.test(str);
};

exports.isClosingChar = function(str) {
  return /[\])}>]/.test(str);
};

exports.isEndingChar = function(str) {
  return /[%!?.,;:]/.test(str) || exports.isClosingChar(str);
};

exports.isWordChar = function(str) {
  return wordRegex().test(str);
};

exports.isSpecialChar = function(str) {
  return /[‘’“”،、‹›«»†‡°″¡¿※#№\‱¶′‴§‖¦]/.test(str);
};

exports.isSeparator = function(str) {
  return exports.isLooseSeparator(str) || exports.isTightSeparator(str);
};

exports.isTightSeparator = function(str) {
  return /[-‒−–—―\\\/⁄]/.test(str);
};

exports.isLooseSeparator = function(str) {
  return /[\s·•|]/.test(str);
};

exports.trimLeft = function(str) {
  return str.replace(/^[ \t]+/, '');
};

exports.trimRight = function(str) {
  return str.replace(/[ \t]+$/, '');
};

exports.stripNewlines = function(str) {
  return str.replace(/\n/g, '');
};

/**
 * Condense newlines in the given string.
 * @param {String} `str`
 * @return {*}
 */

exports.condense = function(str) {
  return str.split('\n').map(function(line) {
    return line.trim() === '' ? '' : line;
  })
  .join('\n').replace(/\n{3,}/g, '\n\n');
};
