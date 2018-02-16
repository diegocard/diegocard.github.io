var gulp = require('gulp');
var minifyCSS = require('gulp-csso');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');

gulp.task('css', function () {
	return gulp.src('css/*.css')
		.pipe(concat('app.min.css'))
		.pipe(minifyCSS())
		.pipe(gulp.dest('css'))
});

gulp.task('js', function () {
	return gulp.src('client/javascript/*.js')
		.pipe(sourcemaps.init())
		.pipe(concat('app.min.js'))
		.pipe(sourcemaps.write())
		.pipe(gulp.dest('javascript'))
});

gulp.task('default', ['css', 'js']);