'use strict';

require('mocha');
var Breakdance = require('breakdance');
var assert = require('assert');
var utils = require('..');
var breakdance;

describe('utils', function() {
  beforeEach(function() {
    breakdance = new Breakdance();
  });

  describe('.toAttribs', function() {
    it('should create a string from the given object', function() {
      assert.equal(utils.toAttribs({class: 'foo language-css'}), ' class="foo language-css"');
      assert.equal(utils.toAttribs({class: 'foo lang-css'}), ' class="foo lang-css"');
      assert.equal(utils.toAttribs({class: 'language-css'}), ' class="language-css"');
      assert.equal(utils.toAttribs({class: 'language-css '}), ' class="language-css"');
      assert.equal(utils.toAttribs({class: 'lang-css '}), ' class="lang-css"');
    });
  });

  describe('.formatLink', function() {
    var node, link;

    it('should format a src url', function() {
      node = {attribs: {src: 'A b c'}};
      link = utils.formatLink(node, 'src', breakdance.compiler);
      assert.equal(link, '(A b c)');

      node = {attribs: {src: 'foo.src'}};
      link = utils.formatLink(node, 'src', breakdance.compiler);
      assert.equal(link, '(foo.src)');
    });

    it('should format a href url', function() {
      node = {attribs: {href: 'A b c'}};
      link = utils.formatLink(node, 'href', breakdance.compiler);
      assert.equal(link, '(A b c)');
    });

    it('should slugify anchor (in-page) urls', function() {
      node = {attribs: {href: '#A b c'}};
      link = utils.formatLink(node, 'href', breakdance.compiler);
      assert.equal(link, '(#a-b-c)');
    });
  });

  describe('.getLang', function() {
    it('should get the language from the class', function() {
      assert.equal(utils.getLang({class: 'foo language-css'}), 'css');
      assert.equal(utils.getLang({class: 'foo lang-css'}), 'css');
      assert.equal(utils.getLang({class: 'language-css'}), 'css');
      assert.equal(utils.getLang({class: 'language-css '}), 'css');
      assert.equal(utils.getLang({class: 'lang-css '}), 'css');
    });

    it('should get the language from the data-lang attribute', function() {
      assert.equal(utils.getLang({'data-lang': 'foo language-css'}), 'css');
      assert.equal(utils.getLang({'data-lang': 'foo lang-css'}), 'css');
      assert.equal(utils.getLang({'data-lang': 'language-css'}), 'css');
      assert.equal(utils.getLang({'data-lang': 'language-css '}), 'css');
      assert.equal(utils.getLang({'data-lang': 'lang-css '}), 'css');
    });

    it('should get the language from the data-language attribute', function() {
      assert.equal(utils.getLang({'data-language': 'foo language-css'}), 'css');
      assert.equal(utils.getLang({'data-language': 'foo lang-css'}), 'css');
      assert.equal(utils.getLang({'data-language': 'language-css'}), 'css');
      assert.equal(utils.getLang({'data-language': 'language-css '}), 'css');
      assert.equal(utils.getLang({'data-language': 'lang-css '}), 'css');
    });
  });
});
