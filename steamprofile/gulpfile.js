let gulp = require('gulp');
let concat = require('gulp-concat');
let sourcemaps = require('gulp-sourcemaps');
let uglify = require('gulp-uglify');
let plumber = require('gulp-plumber');
let rename = require('gulp-rename');
let clean = require('gulp-clean');
let uglifyCSS = require('gulp-uglifycss');
let connect = require('gulp-connect');
let watch = require('gulp-watch');

let cssFiles = './css/*.css';
let jsFiles = [
	'./javascript/prototype-1.7.js',
	'./javascript/_combined.js',
	'./javascript/global.js',
	'./javascript/jquery-1.11.1.min.js',
	'./javascript/tooltip.js',
	'./javascript/shared_global.js',
	'./javascript/jquery_init.js',
	'./javascript/modalContent.js',
	'./javascript/modalv2.js',
	'./javascript/profile.js',
	'./javascript/stickers.js',
	'./javascript/reportedcontent.js',
	'./javascript/shared_responsive_adapter.js',
	'./javascript/*.js'
]

gulp.task('css', () => {
	return gulp.src(cssFiles)
		.pipe(sourcemaps.init())
		.pipe(concat('app.min.css'))
		.pipe(uglifyCSS({compatibility: 'ie8'}))
		.pipe(sourcemaps.write('maps'))
		.pipe(gulp.dest('dist'));
});

gulp.task('js', () => {
	return gulp.src(jsFiles)
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