/*
* Compiles a directory of assets into another
*/
var compile = function(source, output, useropts, cb) {
  var self = this;
  
  /*
  * Deps
  */
  var async = require('async');
  var path = require('path');
  var utils = require('utilities');
  
  /*
  * Check if args are absolute paths
  */
  var isAbs = function(path) {
    return path.charAt(0) == '/' || path.charAt(0) == '\\';
  };
  
  if(!isAbs(source) || !isAbs(output)) {
    cb('Velociraptor will only take absolute paths. Try using path.resolve(target).');
    return;
  }
  
  /*
  * Handle optional opts
  */
  var opts = {
    //Always lowercase!
    ignoredExts:['less','ds_store'],
    minify:false
  };
  
  if(cb == null) {
    cb = useropts;
  }
  else {
    utils.enhance(opts, useropts);
  }
  
  /*
  * Read packages
  */
  var packages_def = path.join(source,'bundles.json');
  var package_src = require(packages_def);
  var packages = {};
  
  //Remember packaged files so we don't copy them later
  var packagedFiles = [path.join(source, 'bundles.json')];
  
  //Append the source prefix to package definitions
  for(var key in package_src) {
    if(package_src.hasOwnProperty(key)) {
      var abs_key = path.join(output,key);
      packages[abs_key] = [];
      for(var i=0; i<package_src[key].length; i++) {
        if(typeof package_src[key][i] == "object") {
          packages[abs_key][i] = utils.enhance({},package_src[key][i],{dir: path.join(source,package_src[key][i].dir)});
          packagedFiles.push(packages[abs_key][i].dir + "/");
        } 
        else {
          packages[abs_key][i] = path.join(source,package_src[key][i]);
          packagedFiles.push(packages[abs_key][i]);
        }
      }
    }
  }
  
  /**
  * Prepare the output dir
  */
  self.prepare(output, function(err) {
    if(err) {
      cb(err);
    }
    else {
      //Returns an async worker that calls compileAsset
      var processAsset = function(outputFile, inputFiles) {
        return function(async_cb) {
          self.compileAsset(outputFile, inputFiles, opts, async_cb);
        };
      };
      
      //Create a worker for each package
      var assetWorkers = [];
      for(var assetName in packages) {
        if(packages.hasOwnProperty(assetName)) {
          assetWorkers.push(processAsset(assetName,packages[assetName]));
        }
      }
      
      //Run the workers in parallel
      async.parallel(assetWorkers,function(err,results) {
        if(err) {
          cb("Failed to compile: " + err);
        }
        else {
          //Copy over any assets that were not part of a package
          self.copyDir(source, output, packagedFiles, opts.ignoredExts, function(err, copied) {
            if(err) {
              cb("Failed to copy: " + err);
            }
            else {
              cb(null, {
                packages:results.length,
                packageSources:packagedFiles.length-1,
                minified:opts.minify,
                copied:copied.length
              });
            }
          });
        }
      });
    }
  });
};

/*
* Compiles a resource into a file
*/
var compileAsset = function(outputFile, inputFiles, opts, cb) {
  var self = this;
  
  /*
  * Deps
  */
  var fs = require('fs');
  var nodefs = require('node-fs');
  var path = require('path');
  var minify = opts.minify?true:false;
  
  //Check if we are compiling a supported format
  var supportedFormats = ['js','css'];
  var outputFormat = outputFile.split('.').pop();
  var outputIsSupported = supportedFormats.indexOf(outputFormat) >= 0;
  if(!outputIsSupported) {
    cb('We only support ' + supportedFormats.join(',') + ' compilation at this time, not ' + outputFormat);
    return;
  }
  
  //Called after the asset is compiled
  var afterCompile = function(err, buffer) {
    if(err) {
      cb(err);
    }
    else {
      //Buffer will contain the compiled asset data, this function writes it
      var writeFile = function() {
        fs.writeFile(outputFile, buffer, function(err) {
          if(err) {
            cb(err);
          }
          else {
            cb(null,outputFile);
          }
        });
      };
      
      //Is this file in a directory?
      if(outputFile.indexOf('/') >= 0) {
        //If so, make sure it exists
        var targetDir = outputFile.substring(0, outputFile.lastIndexOf('/'));
        targetDir = path.resolve(__dirname,targetDir);
        nodefs.mkdir(targetDir, 511, true, function(err) {
          if(err) {
            cb(err);
          }
          else {
            writeFile();
          }
        });
      }
      else {
        writeFile();
      }
    }
  };
  
  //Compile for that specific format
  switch(outputFormat) {
    case 'js':
      self.compileJS(outputFile,inputFiles,opts,afterCompile);
    break;
    case 'css':
      self.compileCSS(outputFile,inputFiles,opts,afterCompile);
    break;
  }
};

/*
* Compiles a Javascript resource into a string
*/
var compileJS = function(output, inputFiles, opts, cb) {
  var self = this;
  var pathlib = require("path");
  var uglifyjs = require("uglify-js");
  var engines = require("universal-jst");
  var utils = require("utilities");
  var hbplaceholder = "/*[["+utils.string.uuid(32)+"]]*/";
  var minify = opts.minify ? true : false;
  
  var handleBarsDirs = [];
  
  var handler = function(path, data, async_cb) {
    var ext = path.split('.').pop();
    
    switch(ext) {
      case 'handlebars':
      case 'hbs':
      case 'hb':
        var dir = pathlib.dirname(path);
        
        if(handleBarsDirs.indexOf(dir)<0) {
          handleBarsDirs.push(dir);
        }
        
        //We'll do handlebars compilation separately, so send a placeholder string to the buffer
        async_cb(null, hbplaceholder);
      break;
      
      //Treat as JS
      default:
        async_cb(null, data);
    }
  };
  
  opts = utils.enhance({},opts,{handler:handler});
  
  self.concat(inputFiles, opts, function(err, buffer, pieces) {
  
    //Run after template compilation
    var afterTemplateCompilation = function(templateData) {
      if(templateData) {
        //Order the template in the correct location
        var beforeTemplatePieces = [];
        var afterTemplatePieces = [];
        var hasReachedTemplatePlaceholder = false;
        
        for(var i=0, ii=pieces.length; i<ii; i++) {
          //Within template section
          if(pieces[i] === hbplaceholder) {
            hasReachedTemplatePlaceholder = true;
          }
          else {
            //After template section
            if(hasReachedTemplatePlaceholder) {
              afterTemplatePieces.push(pieces[i]);
            }
            else {
              beforeTemplatePieces.push(pieces[i]);
            }
          }
        }
        
        //Join into buffer
        buffer = beforeTemplatePieces.join("\n") + templateData + "\n" + afterTemplatePieces.join("\n");
      }
    
      if(minify) {
        cb(null, uglifyjs.minify(buffer, {fromString: true}));
      }
      else {
        cb(null, buffer);
      }
    };
    
    //Now we compile the handlebars directories
    if(handleBarsDirs.length) {
      engines.hbs(handleBarsDirs[0], function(err, data) {
        afterTemplateCompilation(data.join('\n'));
      });
    }
    else {
      afterTemplateCompilation();
    }
  });
};

/*
* Compiles a CSS resource into a string
*/
var compileCSS = function(output, inputFiles, opts, cb) {
  var self = this;
  var cleanCSS = require('clean-css');
  var less = require('less');
  var minify = opts.minify ? true : false;
  
  var lessHander = function(filename, data, handler_cb) {
    var filedir = filename.substring(0, filename.lastIndexOf('/'));
    
    if(filename.split('.').pop().toLowerCase()==='less') {
      var parser = new(less.Parser)({
          paths: [filedir], // Specify search paths for @import directives
          filename: filename // Specify a filename, for better error messages
      });
      
      parser.parse(data, function (err, tree) {
        if(err) {
          handler_cb(err);
        }
        else {
          handler_cb(null,tree.toCSS({ compress: minify }));
        }
      });
    }
    else {
      handler_cb(null, data);
    }
  };

  self.concat(inputFiles, {handler: lessHander}, function(err,buffer) {
    if(err) {
      cb(err);
    }
    //Minify?
    else if(minify) {
      cb(null, cleanCSS.process(buffer) );
    }
    else {
      cb(null, buffer);
    }
  });
};

/*
* Concatenates files
*/
var concat = function(inputFiles, opts, cb) {
  var async = require('async');
  var fs = require('fs');
  var walk = require('walk');
  var path = require('path');
  var handler;
  
  if(cb === undefined) {
    cb = opts;
  }
  else {
    handler = opts.handler ? opts.handler : null;
  }

  //Returns an async worker
  var loadFile = function(path) {
    return function(async_cb) {
      fs.readFile(path, 'utf-8', function(err, data) {
        if (err) {
          async_cb(err);
        } else {
          //Do we have to run a handler?
          if(handler) {
            handler(path,data,async_cb);
          }
          else {
            async_cb(null, data);
          }
        }
      });
    };
  };
  
  var processInput = function(inputFile) {
    return function(async_cb) {
      if(typeof inputFile === 'object') {
          //Directory?
          var walker = walk.walk(inputFile.dir, {
            followLinks: false
          });
          
          walker.on('file', function(root, stat, next) {
            var filename = path.join(root,stat.name);
            if(!opts.ignoredExts || opts.ignoredExts.indexOf(stat.name.split('.').pop().toLowerCase()) < 0) {
              fileWorkers.push(loadFile(filename));
            }
            next();
          });
          
          walker.on('end', function() {
            async_cb(null);
          });
      }
      else {
        fileWorkers.push(loadFile(inputFile));
        async_cb(null);
      }
    };
  };
  
  //Create a worker for each file
  var fileWorkers = [];
  var fileLoaders = [];
  
  for(var i=0; i<inputFiles.length; i++) {
    fileLoaders.push(processInput(inputFiles[i]));
  }
  
  async.series(fileLoaders, function(err) {
    //Run all the workers in series
    async.series(fileWorkers, function(err,results) {
      if(err) {
        cb(err);
      }
      else {
        //Results is an array of data, so concatenate that into a string buffer and return it
        cb(null, results.join('\n'), results );
      }
    });
  });
}

/*
* Creates and empties a directory
*/
var prepare = function(dir, cb) {
  var nodefs = require('node-fs');
  var self = this;
  nodefs.mkdir(dir, 511, true, function(err) {
    if(err) {
      cb(err);
    }
    else {
      self.empty(dir,function(err) {
        if(err) {
          cb(err);
        }
        else {
          cb(null);
        }
      });
    }
  });
}

/*
* Empties a directory
* @param {String} The directory to empty
*/
var empty = function(dir, deleteToo, cb) {
  var fs = require("fs");
  var path = require("path");
  var async = require("async");
  
  if(!cb) {
    cb = deleteToo;
    deleteToo = false;
  }
  
  //Returns an async task for the filename
  var processFile = function(filename) {
    return function(async_cb) {
      fs.stat(filename, function(err, stats) {
        if(err) {
          async_cb(err);
        }
        else {
          if(stats.isDirectory()) {
            //Recursively empty directory
            empty(filename, function(err) {
              if(err) {
                async_cb(err);
              }
              else {
                //Complete by removing the directory
                fs.rmdir(filename,async_cb);
              }
            });
          }
          else {
            fs.unlink(filename, async_cb);
          }
        }
      });
    };
  };
  
  //Check if directory exists
  fs.exists(dir, function(exists) {
    if(!exists) {
      cb();
    }
    else {
      //Read directory
      fs.readdir(dir,function(err,files) {
        if(err) {
          cb(err);
        }
        else {
          //Build an array of async tasks for each file we encounter
          var todo = [];
          for(var i=0; i<files.length; i++) {
            var filename = path.join(dir, files[i]);
            todo.push(processFile(filename));
          }
          //Execute the tasks in parallel
          async.parallel(todo, function(err) {
            if(deleteToo) {
              fs.rmdir(dir,cb);
            }
            else {
              cb(err);
            }
          });
        }
      });
    }
  });
};

/*
* Copies a file
*/
var copyFile = function(source, target, cb) {
  var self=this;
  
  /*
  * Deps
  */
  var fs = require('fs');
  var nodefs = require('node-fs');
  var path = require('path');
  
  //Recursively ensure that directory exists
  var targetDir = target.substring(0, target.lastIndexOf('/'));
  targetDir = path.resolve(__dirname,targetDir);
  
  nodefs.mkdir(targetDir, 511, true, function(err) {
    if (err) {
      cb(err);
    } else {
      var done = function(err) {
        if (!cbCalled) {
          if (err) {
            cb(err);
          } else {
            cb(null, source, target);
          }
          cbCalled = true;
        }
      };
      var cbCalled = false;
      var rd = fs.createReadStream(source);
      rd.on('error', function(err) {
        if(err) {
          console.log(err);
        }
        done(err);
      });
      var wr = fs.createWriteStream(target);
      wr.on('error', function(err) {
        if(err) {
          console.log(err);
        }
        done(err);
      });
      wr.on('close', function() {
        done();
      });
      rd.pipe(wr);
    }
  });
}

/*
* Copies a directory into another, ignoring some files
*/
var copyDir = function(source, target, ignoreFiles, ignoreExts, cb) {
  var self = this;
  var walk = require('walk');
  var async = require('async');
  var path = require('path');
  
  // Walker options
  var walker = walk.walk(source, {
    followLinks: false
  });
  
  //Returns an async worker that copies the file with copyFile
  var processFile = function(filename) {
    return function(async_cb) {
      var outputFile = filename.replace(source, target);
      
      self.copyFile(filename, outputFile, function(err) {
        if(err) {
          async_cb(err);
        }
        else {
          async_cb(null, outputFile);
        }
      });
    };
  };
  
  //Walk the source directory, adding a worker for each file
  var fileWorkers = [];
  
  walker.on('file', function(root, stat, next) {
    var filename = path.join(root,stat.name);
    var fileext = stat.name.split('.').pop().toLowerCase();
    
    var copyable = true;
    
    //Don't copy ignored files
    if(ignoreFiles.indexOf(filename) >= 0 || ignoreExts.indexOf(fileext) >= 0) {
      copyable = false;
    }
    
    if(copyable) {
      //Check if any of the ignoreFiles are directories
      for(var i=0, ii=ignoreFiles.length; i<ii; i++) {
        if(ignoreFiles[i].charAt(ignoreFiles[i].length-1) == '/') {
          if(filename.indexOf(ignoreFiles[i]) >= 0) {
            copyable=false;
            break;
          }
        }
      }
    }
    
    if(copyable) {
      fileWorkers.push(processFile(filename));
    }
    
    next();
  });
  walker.on('end', function() {
    async.parallel(fileWorkers,cb);
  });
};

//Exports
exports.compile = compile;
exports.compileAsset = compileAsset;
exports.compileJS = compileJS;
exports.compileCSS = compileCSS;
exports.copyFile = copyFile;
exports.copyDir = copyDir;
exports.concat = concat;
exports.prepare = prepare;
exports.empty = empty;
