const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const StatsPlugin = require('stats-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const urljoin = require('urljoin');


const rulesByExtension = require('./webpack/lib/rulesByExtension');

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Possible options:
// buildType : possible values ['npm', 'host', 'frame', 'dev', 'test']
//  - npm : build in prevision of the npm release
//  - host : build the host lib only
//  - frame : build the frame lib only
//  - dev : build both the frame and the host for the dev server
//  - test : build for tests
// publicPath: a way to override the public path (in case of testing on a test CDN)
// debug : should webpack be in debug mode or not
// minimize : should the output be minified
// devtool : webpack devtool options override (sourcemap config)
// generateStats : should webpack generate a stats.json file for debugging

module.exports = function(options) {
    const VERSION = require('./package.json').version;
    const PACKAGE_NAME = require('./package.json').name;
    const LICENSE = fs.readFileSync('LICENSE', 'utf8');
    const {buildType} = options;

    // set branding variables in the env vars or pass them via the options
    const vendorId = process.env.VENDOR_ID || options.vendorId || PACKAGE_NAME;
    const isBranded = process.env.IS_BRANDED === 'true' || options.isBranded || false;
    const licenseContent = process.env.LICENSE || options.license || LICENSE;
    const providedPublicPath = process.env.PUBLIC_PATH || options.publicPath;
    const version = process.env.VERSION || options.version || VERSION;
    const globalVarName = capitalizeFirstLetter(vendorId);

    let entry;

    if (buildType === 'npm') {
        entry = {
            index: './src/host/js/npm'
        };
    } else if (buildType === 'host') {
        entry = {
            [vendorId]: './src/host/js/index'
        };
    } else if (buildType === 'frame') {
        entry = {
            frame: ['babel-polyfill', './src/frame/js/index']
        };
    } else if (buildType === 'dev') {
        entry = {
            [vendorId]: './src/host/js/index',
            frame: ['babel-polyfill', './src/frame/js/index']
        };
    } else {
        throw new Error('Unknown build type');
    }

    const rules = {
        'png|jpg|jpeg|gif|svg': {
            loader: 'url-loader',
            options: {
                limit: 1
            }
        },
        mp3: {
            loader: 'url-loader',
            options: {
                limit: 1
            }
        }
    };

    const hostJsRule = {
        test: /\.jsx?(\?.*)?$/,
        include: [
            path.resolve(__dirname, 'src/host/'),
            path.resolve(__dirname, 'src/shared/')
        ],
        use: [
            {
                loader: 'babel-loader',
                options: {
                    forceEnv: 'host'
                }
            }
        ]
    };

    const frameJsRule = {
        test: /\.jsx?(\?.*)?$/,
        include: [
            path.resolve(__dirname, 'src/frame/'),
            path.resolve(__dirname, 'src/shared/'),
            path.resolve(__dirname, 'test')
        ],
        use: [
            {
                loader: 'babel-loader',
                options: {
                    forceEnv: buildType === 'test' ? 'test' : 'frame'
                }
            }
        ]
    };

    const hostStyleRule = {
        test: /\.less(\?.*)?$/,
        include: [
            path.resolve(__dirname, 'src/host/'),
            path.resolve(__dirname, 'src/shared/')
        ],
        use: [
            {
                loader: 'style-loader/useable',
                options: {
                    insertAt: 'bottom'
                }
            },
            {
                loader: 'css-loader',
                options: {
                    modules: true,
                    sourceMap: true
                }
            },
            {
                loader: 'less-loader',
                options: {
                    sourceMap: true
                }
            },
        ]
    };

    const frameStyleRule = {
        test: /\.less(\?.*)?$/,
        include: [
            path.resolve(__dirname, 'src/frame/'),
            path.resolve(__dirname, 'src/shared/')
        ],
        use: ExtractTextPlugin.extract({
            use: [
                'css-loader',
                'less-loader'
            ]
        })
    };

    const publicPath = providedPublicPath ?
        providedPublicPath :
        buildType === 'dev' ?
            '/_assets/' :
            'https://cdn.smooch.io/';

    // Only need to append the version if we're building the host lib or the frame lib
    // in prevision of a release.
    const baseFilename = ['host', 'frame'].includes(buildType) ?
        `[name].${version}` :
        '[name]';

    // Only use .min.js if we ask for minification
    const fileExtension = options.minimize ?
        '.min.js' :
        '.js';

    const output = {
        path: options.outputPath || path.join(__dirname, buildType === 'npm' ? 'lib' : 'dist'),
        publicPath,
        filename: baseFilename + fileExtension,
        chunkFilename: '[chunkhash].js',
        libraryTarget: buildType === 'npm' ? 'commonjs2' : 'var',
        pathinfo: options.debug
    };

    const excludeFromStats = [
        /node_modules[\\\/]/
    ];


    // The following variables are about how the frame files will be referenced in the iframe html.
    // see `FRAME_JS_URL` and `FRAME_CSS_URL` in `src/host/js/web-messenger.js`.
    // In host and npm mode, it's referencing files that should already (or soon to) be on the CDN
    // so it should target the full name + version.
    // In other cases, iframe.js/css will do just fine.
    let frameJsFilename;
    let frameCssFilename;

    if (['host', 'npm'].includes(buildType)) {
        // in this case, it's referencing an already built frame lib
        // and it's mostly likely minified already.
        frameJsFilename = `frame.${version}.min.js`;
        frameCssFilename = `frame.${version}.css`;
    } else {
        frameJsFilename = 'frame.js';
        frameCssFilename = 'frame.css';
    }

    const plugins = [
        new webpack.DefinePlugin({
            VERSION: `'${version}'`,
            VENDOR_ID: `'${vendorId}'`,
            GLOBAL_VAR_NAME: `'${globalVarName}'`,
            FRAME_JS_URL: `'${urljoin(publicPath, frameJsFilename)}'`,
            FRAME_CSS_URL: `'${urljoin(publicPath, frameCssFilename)}'`,
            SENTRY_DSN: options.sentryDsn ? `'${options.sentryDsn}'` : 'undefined',
            IS_BRANDED: `${isBranded}`
        })
    ];

    if (buildType === 'frame') {
        plugins.push(new ExtractTextPlugin(`frame.${version}.css`));
    } else {
        plugins.push(new ExtractTextPlugin('frame.css'));
    }

    if (options.generateStats) {
        plugins.push(new StatsPlugin('stats.json', {
            chunkModules: true,
            exclude: excludeFromStats
        }));
    }

    if (options.minimize) {
        plugins.push(
            new webpack.optimize.UglifyJsPlugin({
                sourceMap: true,
                compressor: {
                    warnings: false
                }
            }),
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('production')
                }
            }),
            new webpack.NoEmitOnErrorsPlugin(),

            new webpack.BannerPlugin({
                banner: vendorId + ' ' + version + ' \n' + licenseContent,
                entryOnly: true
            }),
            new OptimizeCssAssetsPlugin({
                assetNameRegExp: /\.css$/g,
                cssProcessor: require('cssnano'),
                cssProcessorOptions: {
                    preset: [
                        'default',
                        {
                            discardComments: {
                                removeAll: true
                            },
                            discardDuplicates: {
                                removeAll: true
                            }
                        }
                    ]
                },
                canPrint: false
            })
        );
    } else if (buildType === 'npm') {
        plugins.push(
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('production')
                }
            }),
            new webpack.NoEmitOnErrorsPlugin(),

            new webpack.BannerPlugin({
                banner: vendorId + ' ' + version + ' \n' + licenseContent,
                entryOnly: true
            })
        );
    } else if (options.test) {
        plugins.push(
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('test')
                }
            })
        );
    } else {
        plugins.push(
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('development')
                }
            })
        );
    }

    plugins.push(new webpack.LoaderOptionsPlugin({
        debug: !!options.debug,
        minimize: !!options.minimize
    }));

    plugins.push(new webpack.SourceMapDevToolPlugin({
        filename: buildType !== 'test' && '[file].map'
    }));

    return {
        entry: entry,
        output: output,
        target: 'web',
        module: {
            rules: rulesByExtension(rules)
                .concat([
                    hostStyleRule,
                    frameStyleRule,
                    hostJsRule,
                    frameJsRule
                ])
        },
        resolve: {
            extensions: ['.js', '.jsx'],
            modules: [
                'node_modules'
            ]
        },
        plugins: plugins,
        devServer: {
            stats: {
                cached: false,
                exclude: excludeFromStats
            }
        }
    };
};
