#Velociraptor

Node.js asset compiler that supports JavaScript, Handlebars, CSS and LESS.

##What It Does
Velociraptor will compile assets in a `source` directory and dump them into an `output` directory.

1. Velociraptor will first build the bundles defined in `source/bundles.json`
2. Any files in `source` that were not part of a bundle will be copied to `output`
  1. **Important:** `.less` files will not be copied as part of this step as they are expected to be part of a bundle.

##bundles.json example
```json
{
  "css/styles.css":[
    "less/bootstrap.less",
    "less/style.less",
    "less/responsive.less"
  ],
  "js/scripts.js":[
    "js/jquery.js",
    "js/bootstrap.js",
    "js/core/core.js",
    {
      "dir": "templates",
      "type": "handlebars"
    },
    "js/config/init.js"
  ]
}

```

###Handlebars
To precompile, put your templates in a directory and Velociraptor will recursively discover your templates. Note the special syntax in `bundles.json` -- you must define a directory, not the individual files.

##Command-line Usage
```bash
# Compile from ./assets to ./tmp
# without minification
velociraptor ./assets ./tmp

# Compiling: /somepath/assets
#      into: /somepath/tmp
#            without minification
# Compiled 2 bundles from 7 sources
# Copied 4

# Compiling with minification
velociraptor -m ./assets ./tmp
```

##Programmatic Usage
```js
var Velociraptor = require('velociraptor');

//No minification
Velociraptor.compile(source, target, function(err, results) {
  if(err) {
    console.log("Error: "+err);
  }
  else {
    console.log(results);
    // e.g.
    // {
    //    bundles: 2
    //  , bundlesources: 7
    //  , minified: false
    //  , copied: 5
    // }
  }
});

//Minification
Velociraptor.compile(source, target, {minify:true}, function(err, results) {
  //etc...
});
```