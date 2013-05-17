'use strict';

var tests;
var source = '../assets';
var output = '../tmp';

/*
* Deps
*/
var Velociraptor = require('../../lib/velociraptor.js');
var path = require('path');
var assert = require('assert');

/*
* Normalize paths
*/
source = path.resolve(__dirname, source);
output = path.resolve(__dirname, output);

tests = {
  'test default compilation': function(next) {
    Velociraptor.compile(source, output, function(err, results) {
      assert.strictEqual(err, null, err);
      assert.strictEqual(results.packages,2);
      assert.strictEqual(results.packageSources,7);
      assert.strictEqual(results.minified,false);
      assert.strictEqual(results.copied,4);
      next();
    })
  },
  'test minify compilation': function(next) {
    Velociraptor.compile(source, output, {minify:true}, function(err, results) {
      assert.strictEqual(err, null, err);
      assert.strictEqual(results.packages,2);
      assert.strictEqual(results.packageSources,7);
      assert.strictEqual(results.minified,true);
      assert.strictEqual(results.copied,4);
      next();
    })
  }
};

module.exports = tests;
