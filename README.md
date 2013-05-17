#Velociraptor

An asset compiler for Node.js

##Command-line Usage
```bash
// Compile from ./assets to ./tmp
// without minification
velociraptor ./assets ./tmp

// Compiling with minification
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
    //    packages: 2
    //  , packageSources: 7
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