var t = new jake.TestTask('velociraptor', function () {
  this.testFiles.include('test/tests/*.js');
});

var p = new jake.NpmPublishTask('velociraptor', [
, 'Jakefile'
, 'README.md'
, 'package.json'
, 'lib/*'
, 'bin/*'
, 'test/*'
]);