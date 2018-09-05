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

let cssFiles = [
	'./vendor/bootstrap/css/bootstrap.min.css',
	'./vendor/font-awesome/css/font-awesome.min.css',
	'./css/font.css',
	'./css/theme.css',
	'./css/custom.css',
	'./vendor/datatables/dataTables.bootstrap4.css',
	'./vendor/datatables/responsive.bootstrap4.min.css',
	'./css/wt-editor.min.css'
];

let jsFiles = [
	'./vendor/jquery/jquery.min.js',
	'./vendor/popper.js/umd/popper.min.js',
	'./vendor/bootstrap/js/bootstrap.min.js',
	'./vendor/jquery.cookie/jquery.cookie.js',
	'./vendor/chart.js/Chart.min.js',
	'./vendor/jquery-validation/jquery.validate.min.js',
	'./vendor/datatables/jquery.dataTables.js',
	'./vendor/datatables/dataTables.bootstrap4.js',
	'./vendor/datatables/dataTables.responsive.min.js',
	'./vendor/datatables/responsive.bootstrap4.min.js',
	'./vendor/datatables/tables-datatable.js',
	'./js/charts-home.js',
	'./js/front.js'
];

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
	watch(['js/**','css/**'], () => {
		gulp.start('build');
	}).pipe(connect.reload());
});

gulp.task('build', ['clean', 'css', 'js']);
gulp.task('watch', ['build', 'watch-and-reload', 'server']);