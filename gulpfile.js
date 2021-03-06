var gulp = require('gulp');
var del = require('del');
var concat = require('gulp-concat');

//TODO: this _needs_ to be extracted to a dedicated gulp plugin, see: https://github.com/sindresorhus/gulp-traceur/issues/54
//more generally - we should better understand what is missing from the the gulp-traceur so it can be used for Angular2 projects
function transpile(options) {

    var traceur = require('traceur');
    var through = require('through2');
    var path = require('path');

    function cloneFile(file, override) {
        var File = file.constructor;
        return new File({
            path: override.path || file.path,
            cwd: override.cwd || file.cwd,
            contents: new Buffer(override.contents || file.contents),
            base: override.base || file.base});
    }

    return through.obj(function (file, enc, done) {

        var originalFilePath = file.history[0];

        try {
            options.moduleName = path.relative(file.base, file.path).split(path.sep).join('/').replace('.js', '');
            var transpiledContent = traceur.compile(file.contents.toString(), options, originalFilePath);
            this.push(cloneFile(file, {contents: transpiledContent}));
            done();

        } catch (errors) {
            if (errors.join) {
                throw new Error('gulp-traceur:\n  ' + errors.join('\n  '));
            } else {
                console.error('Error when transpiling:\n  ' + originalFilePath);
                throw errors;
            }
        }
    });
}

var PATHS = {
    src: {
        js: 'src/*.js',
        html: 'src/*.html'
    },
    lib: [
        'node_modules/traceur/bin/traceur-runtime.js',
        'node_modules/es6-module-loader/dist/es6-module-loader-sans-promises.src.js',
        'node_modules/systemjs/lib/extension-register.js',
        'node_modules/angular2/node_modules/zone.js/zone.js'
    ]
};

gulp.task('clean', function(done) {
  del(['dist'], done);
});

gulp.task('js', function () {
    return gulp.src('src/**/*.js')
        .pipe(transpile({
            modules: 'instantiate',
            annotations: true,
            types: true
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('html', function () {
    return gulp.src(PATHS.src.html)
        .pipe(gulp.dest('dist'));
});

gulp.task('libs', ['angular2'], function () {
    return gulp.src(PATHS.lib)
        .pipe(gulp.dest('dist/lib'));
});

gulp.task('angular2', function () {

    var rename = require('gulp-rename');

    //transpile & concat
    return gulp.src(['node_modules/angular2/*.es6', 'node_modules/angular2/src/**/*.es6'], { base: 'node_modules' })
        .pipe(rename({extname: ".js"}))
        .pipe(transpile({
            modules: 'instantiate',
            annotations: true,
            types: true
        }))
        .pipe(concat('angular2.js'))
        .pipe(gulp.dest('dist/lib'));
});

gulp.task('play', ['default'], function () {

    var http = require('http');
    var connect = require('connect');
    var serveStatic = require('serve-static');
    var open = require('open');

    var port = 9000, app;

    gulp.watch(PATHS.src.html, ['html']);
    gulp.watch(PATHS.src.js, ['js']);

    app = connect().use(serveStatic(__dirname + '/dist'));  // serve everything that is static
    http.createServer(app).listen(port, function () {
        open('http://localhost:' + port, 'chrome');
    });
});

gulp.task('default', ['js', 'html', 'libs']);