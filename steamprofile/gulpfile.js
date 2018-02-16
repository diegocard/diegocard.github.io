let gulp = require('gulp');
let concat = require('gulp-concat');
let sourcemaps = require('gulp-sourcemaps');
let uglify = require('gulp-uglify');
let plumber = require('gulp-plumber');
let rename = require('gulp-rename');
let clean = require('gulp-clean');
let cleanCSS = require('gulp-clean-css');
let connect = require('gulp-connect');
let watch = require('gulp-watch');

gulp.task('js', () => {
	return gulp.src('./javascript/*.js')
		.pipe(sourcemaps.init())
		.pipe(plumber())
		.pipe(concat('app.js'))
		.pipe(gulp.dest('dist'))
		.pipe(uglify())
		.pipe(rename({
			extname: '.min.js'
		}))
		.pipe(sourcemaps.write('maps'))
		.pipe(gulp.dest('dist'))
});

gulp.task('css', () => {
	return gulp.src('css/*.css')
		.pipe(sourcemaps.init())
		.pipe(concat('app.min.css'))
		.pipe(cleanCSS({compatibility: 'ie8'}))
		.pipe(sourcemaps.write('maps'))
		.pipe(gulp.dest('dist'));
  });

gulp.task('clean', () => {
    return gulp.src('dist', {read: false})
        .pipe(clean());
});

gulp.task('server', () => {
	return connect.server({
		root: './',
		livereload: true
	});
});

gulp.task('watch-and-reload', ['build'], () => {
	watch(['javascript/**','css/**','./*.html'], () => {
		gulp.start('build');
	}).pipe(connect.reload());
});

gulp.task('build', ['clean', 'css', 'js']);
gulp.task('watch', ['build', 'watch-and-reload', 'server']);