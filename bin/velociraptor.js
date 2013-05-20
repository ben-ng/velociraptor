#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander');
var path = require('path');
var lib = path.join(path.dirname(fs.realpathSync(__filename)), '../','lib','velociraptor');

function list(val) {
  return val.split(',');
}

program
  .version('0.0.1')
  .usage('[options] <source> <target>')
  .option('-m, --minify', 'Minify')
  .option('-i, --ignore <exts>', 'Ignore extensions', list)
  .parse(process.argv);

if(!program.args[0] || !program.args[1]) {
  console.log('Please specify a source and target directory');
  console.log('Usage: ' + program.usage());
}
else {
  var buffer = '';
  var source = path.resolve(program.args[0]);
  var target = path.resolve(program.args[1]);
  
  buffer += 'Compiling: ' + source + '\n     into: ' + target;
  buffer += '\n           ' + (program.minify ? 'with' : 'without') + ' minification';
  console.log(buffer);
  
  var Velociraptor = require(lib);
  var opts = {
    minify:false
  };
  
  opts.minify = program.minify != null;
  
  Velociraptor.compile(source, target, opts, function(err, results) {
    if(err) {
      console.log("Error: "+err);
    }
    else {
      buffer = '';
      buffer += 'Compiled ' + results.packages + ' packages from ' + results.packageSources + ' sources\n';
      buffer += 'Copied ' + results.copied;
      console.log(buffer);
    }
  });
}