
/*
 *
 */

dw.chart = function(attributes) {

    // private methods and properties
    var dataset,
        theme,
        visualization,
        metric_prefix,
        change_callbacks = $.Callbacks(),
        locale;

    // public interface
    var chart = {
        // returns an attribute
        get: function(key, _default) {
            var keys = key.split('.'),
                pt = attributes;

            _.some(keys, function(key) {
                if (_.isUndefined(pt) || _.isNull(pt)) return true; // break out of the loop
                pt = pt[key];
                return false;
            });
            return _.isUndefined(pt) || _.isNull(pt) ? _default : pt;
        },

        set: function(key, value) {
            var keys = key.split('.'),
                lastKey = keys.pop(),
                pt = attributes;

            // resolve property until the parent dict
            _.each(keys, function(key) {
                if (_.isUndefined(pt[key]) || _.isNull(pt[key])) {
                    pt[key] = {};
                }
                pt = pt[key];
            });

            // check if new value is set
            if (!_.isEqual(pt[lastKey], value)) {
                pt[lastKey] = value;
                change_callbacks.fire(chart, key, value);
            }
            return this;
        },

        // loads the dataset and returns a deferred
        load: function(csv) {
            var datasource,
                dsopts = {
                    firstRowIsHeader: chart.get('metadata.data.horizontal-header', true),
                    transpose: chart.get('metadata.data.transpose', false)
                };

            if (csv) dsopts.csv = csv;
            else dsopts.url = 'data.csv';

            datasource = dw.datasource.delimited(dsopts);

            return datasource.dataset().pipe(function(ds) {
                chart.dataset(ds);
                return ds;
            });
        },

        // returns the dataset
        dataset: function(ds) {
            if (arguments.length) {
                dataset = applyChanges(addComputedColumns(ds));
                return chart;
            }
            return dataset;
        },

        // sets or gets the theme
        theme: function(_theme) {
            if (arguments.length) {
                theme = _theme;
                return chart;
            }
            return theme || {};
        },

        // sets or gets the visualization
        vis: function(_vis) {
            if (arguments.length) {
                visualization = _vis;
                visualization.chart(chart);
                return chart;
            }
            return visualization;
        },

        // returns true if the user has set any highlights
        hasHighlight: function() {
            var hl = chart.get('metadata.visualize.highlighted-series');
            return _.isArray(hl) && hl.length > 0;
        },

        isHighlighted: function(obj) {
            if (_.isUndefined(obj) === undefined) return false;
            var hl = this.get('metadata.visualize.highlighted-series'),
                obj_name = dw.utils.name(obj);
            return !_.isArray(hl) || hl.length === 0 || _.indexOf(hl, obj_name) >= 0;
        },

        locale: function(_locale, callback) {
            if (arguments.length) {
                locale = _locale.replace('_', '-');
                if (Globalize.cultures.hasOwnProperty(locale)) {
                    Globalize.culture(locale);
                    if (typeof callback == "function") callback();
                } else {
                    $.getScript("/static/vendor/globalize/cultures/globalize.culture." +
                      locale + ".js", function () {
       
                        chart.locale(locale);
                        if (typeof callback == "function") callback();
                    });
                }
                return chart;
            }
            return locale;
        },

        metricPrefix: function(_metric_prefix) {
            if (arguments.length) {
                metric_prefix = _metric_prefix;
                return chart;
            }
            return metric_prefix;
        },

        formatValue: function(val, full, round) {
            var format = chart.get('metadata.describe.number-format'),
                div = Number(chart.get('metadata.describe.number-divisor')),
                append = chart.get('metadata.describe.number-append', '').replace(' ', '&nbsp;'),
                prepend = chart.get('metadata.describe.number-prepend', '').replace(' ', '&nbsp;');

            if (div !== 0) val = Number(val) / Math.pow(10, div);
            if (format != '-') {
                if (round || val == Math.round(val)) format = format.substr(0,1)+'0';
                val = Globalize.format(val, format);
            } else if (div !== 0) {
                val = val.toFixed(1);
            }
            return full ? prepend + val + append : val;
        },

        render: function(container) {
            if (!visualization || !theme || !dataset) {
                throw 'cannot render the chart!';
            }
            visualization.chart(chart);
            visualization.__init();
            var $cont = $(container);
            $cont
                .parent()
                .addClass('vis-'+visualization.id)
                .addClass('theme-'+theme.id);
            visualization.render($cont);
        },

        attributes: function(attrs) {
            if (arguments.length) {
                attributes = attrs;
                return chart;
            }
            return attributes;
        },

        onChange: change_callbacks.add,

        columnFormatter: function(column) {
            // pull output config from metadata
            // return column.formatter(config);
            var colFormat = chart.get('metadata.data.column-format', {});
            colFormat = colFormat[column.name()] || {};

            if (column.type() == 'number' && colFormat == 'auto') {
                var mtrSuf = dw.utils.metricSuffix(chart.locale()),
                    values = column.values(),
                    dim = dw.utils.significantDimension(values),
                    div = dim < -2 ? (Math.round((dim*-1) / 3) * 3) :
                            (dim > 2 ? dim*-1 : 0),
                    ndim = dw.utils.significantDimension(_.map(values, function(v) {
                        return v / Math.pow(10, div);
                    }));

                colFormat = {
                    'number-divisor': div,
                    'number-append': div ? mtrSuf[div] || ' × 10<sup>'+div+'</sup>' : '',
                    'number-format': 'n'+Math.max(0, ndim)
                };
            }
            return column.type(true).formatter(colFormat);
        },

        dataCellChanged: function(column, row) {
            var changes = chart.get('metadata.data.changes', []),
                transpose = chart.get('metadata.data.transpose', false),
                changed = false;

            _.each(changes, function(change) {
                var r = "row", c = "column";
                if (transpose) {
                    r = "column";
                    c = "row";
                }
                if (column == change[c] && change[r] == row) {
                    changed = true;
                }
            });
            return changed;
        }

    };

    function applyChanges(dataset) {
        var changes = chart.get('metadata.data.changes', []);
        var transpose = chart.get('metadata.data.transpose', false);
        _.each(changes, function(change) {
            var row = "row", column = "column";
            if (transpose) {
                row = "column";
                column = "row";
            }

            if (dataset.hasColumn(change[column])) {
                if (change[row] === 0) {
                    dataset.column(change[column]).title(change.value);
                }
                else {
                    dataset.column(change[column]).raw(change[row] - 1, change.value);
                }
            }
        });

        var columnFormats = chart.get('metadata.data.column-format', {});
        _.each(columnFormats, function(columnFormat, key) {
            if (columnFormat.type && dataset.hasColumn(key)) {
                dataset.column(key).type(columnFormat.type);
            }
            if (columnFormat['input-format'] && dataset.hasColumn(key)) {
                dataset.column(key).type(true).format(columnFormat['input-format']);
            }
        });
        return dataset;
    }

    function addComputedColumns(dataset) {
        var v_columns = chart.get('metadata.describe.computed-columns', {}),
            data = dataset.list(),
            columnNameToVar = {};

        dataset.eachColumn(function(col) {
            if (col.isComputed) return;
            columnNameToVar[col.name()] = column_name_to_var(col.name());
        });

        _.each(v_columns, add_computed_column);
        
        return dataset;

        function add_computed_column(formula, name) {
            var datefmt = d3.time.format('%Y-%m-%d'),
                values = data.map(function(row) {
                var context = [];
                _.each(row, function(val, key) {
                    if (!columnNameToVar[key]) return;
                    context.push('var '+columnNameToVar[key]+' = '+JSON.stringify(val)+';');
                });
                context.push('var round = d3.round, mean = d3.mean, median = d3.median,'+
                        'sum = d3.sum, max = d3.max, min = d3.min;');
                return (function() {
                    try {
                        return eval(this.context.join('\n')+'\n'+formula);                    
                    } catch (e) {
                        return 'n/a';
                    }
                }).call({ context: context });
            }).map(function(v) {
                if (_.isBoolean(v)) return v ? 'yes' : 'no';
                if (_.isDate(v)) return datefmt(v);
                if (_.isNumber(v)) return ''+v;
                return String(v);
            });
            var v_col = dw.column(name, values);
            v_col.isComputed = true;
            dataset.add(v_col);
        }

        function column_name_to_var(name) {
            return name.toString().toLowerCase()
                .replace(/\s+/g, '_')           // Replace spaces with _
                .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
                .replace(/\_\_+/g, '_')         // Replace multiple - with single -
                .replace(/^_+/, '')             // Trim - from start of text
                .replace(/_+$/, '');            // Trim - from end of text
        }
    }

    return chart;
};
