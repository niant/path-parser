'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var rules = [{
    // An URL can contain a parameter :paramName
    // - and _ are allowed but not in last position
    name: 'url-parameter',
    pattern: /^:([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/,
    regex: /([a-zA-Z0-9-_.~]+)/
}, {
    // Url parameter (splat)
    name: 'url-parameter-splat',
    pattern: /^\*([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/,
    regex: /([^\?]*)/
}, {
    name: 'url-parameter-matrix',
    pattern: /^\;([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/,
    regex: function regex(match) {
        return new RegExp(';' + match[1] + '=([a-zA-Z0-9-_.~]+)');
    }
}, {
    // Query parameter: ?param1&param2
    //                   ?:param1&:param2
    name: 'query-parameter',
    pattern: /^(?:\?|&)(?:\:)?([a-zA-Z0-9-_]*[a-zA-Z0-9]{1})/
}, {
    // Delimiter /
    name: 'delimiter',
    pattern: /^(\/|\?)/,
    regex: function regex(match) {
        return new RegExp(match[0]);
    }
}, {
    // Sub delimiters
    name: 'sub-delimiter',
    pattern: /^(\!|\&|\-|_|\.|;)/,
    regex: function regex(match) {
        return new RegExp(match[0]);
    }
}, {
    // Unmatched fragment (until delimiter is found)
    name: 'fragment',
    pattern: /^([0-9a-zA-Z]+?)/,
    regex: function regex(match) {
        return new RegExp(match[0]);
    }
}];

var tokenise = function tokenise(str) {
    var tokens = arguments[1] === undefined ? [] : arguments[1];

    // Look for a matching rule
    var matched = rules.some(function (rule) {
        var match = str.match(rule.pattern);
        if (!match) return false;

        tokens.push({
            type: rule.name,
            match: match[0],
            val: match.length > 1 ? match.slice(1) : null,
            regex: rule.regex instanceof Function ? rule.regex(match) : rule.regex
        });

        if (match[0].length < str.length) tokens = tokenise(str.substr(match[0].length), tokens);
        return true;
    });
    // If no rules matched, throw an error (possible malformed path)
    if (!matched) {
        throw new Error('Could not parse path.');
    }
    // Return tokens
    return tokens;
};

var Path = (function () {
    function Path(path) {
        _classCallCheck(this, Path);

        if (!path) throw new Error('Please supply a path');
        this.path = path;
        this.tokens = tokenise(path);

        this.hasUrlParams = this.tokens.filter(function (t) {
            return /^url-parameter/.test(t.type);
        }).length > 0;
        this.hasSpatParam = this.tokens.filter(function (t) {
            return /splat$/.test(t.type);
        }).length > 0;
        this.hasMatrixParams = this.tokens.filter(function (t) {
            return /matrix$/.test(t.type);
        }).length > 0;
        this.hasQueryParams = this.tokens.filter(function (t) {
            return t.type === 'query-parameter';
        }).length > 0;
        // Extract named parameters from tokens
        this.urlParams = !this.hasUrlParams ? [] : this.tokens.filter(function (t) {
            return /^url-parameter/.test(t.type);
        }).map(function (t) {
            return t.val;
        })
        // Flatten
        .reduce(function (r, v) {
            return r.concat(v);
        });
        // Query params
        this.queryParams = !this.hasQueryParams ? [] : this.tokens.filter(function (t) {
            return t.type === 'query-parameter';
        }).map(function (t) {
            return t.val;
        })
        // Flatten
        .reduce(function (r, v) {
            return r.concat(v);
        });
        this.params = this.urlParams.concat(this.queryParams);
        // Check if hasQueryParams
        // Regular expressions for url part only (full and partial match)
        this.source = this.tokens.filter(function (t) {
            return t.regex !== undefined;
        }).map(function (r) {
            return r.regex.source;
        }).join('');
    }

    _createClass(Path, [{
        key: '_urlMatch',
        value: function _urlMatch(path, regex) {
            var _this = this;

            var match = path.match(regex);
            if (!match) return null;else if (!this.urlParams.length) return {};
            // Reduce named params to key-value pairs
            return match.slice(1, this.urlParams.length + 1).reduce(function (params, m, i) {
                params[_this.urlParams[i]] = m;
                return params;
            }, {});
        }
    }, {
        key: 'match',
        value: function match(path) {
            var _this2 = this;

            // Check if exact match
            var match = this._urlMatch(path, new RegExp('^' + this.source + (this.hasQueryParams ? '?.*$' : '$')));
            // If no match, or no query params, no need to go further
            if (!match || !this.hasQueryParams) return match;
            // Extract query params
            var queryParams = path.split('?')[1].split('&').map(function (_) {
                return _.split('=');
            }).reduce(function (obj, m) {
                obj[m[0]] = m[1];
                return obj;
            }, {});

            if (Object.keys(queryParams).every(function (p) {
                return Object.keys(_this2.queryParams).indexOf(p) !== 1;
            }) && Object.keys(queryParams).length === this.queryParams.length) {
                // Extend url match
                Object.keys(queryParams).forEach(function (p) {
                    return match[p] = queryParams[p];
                });

                return match;
            }

            return null;
        }
    }, {
        key: 'partialMatch',
        value: function partialMatch(path) {
            // Check if partial match (start of given path matches regex)
            return this._urlMatch(path, new RegExp('^' + this.source));
        }
    }, {
        key: 'build',
        value: function build() {
            var params = arguments[0] === undefined ? {} : arguments[0];

            // Check all params are provided (not search parameters which are optional)
            if (!this.params.every(function (p) {
                return params[p] !== undefined;
            })) throw new Error('Missing parameters');

            var base = this.tokens.filter(function (t) {
                return t.type !== 'query-parameter';
            }).map(function (t) {
                if (t.type === 'url-parameter-matrix') return ';' + t.val[0] + '=' + params[t.val[0]];
                return /^url-parameter/.test(t.type) ? params[t.val[0]] : t.match;
            }).join('');

            var searchPart = this.queryParams.map(function (p) {
                return p + '=' + params[p];
            }).join('&');

            return base + (searchPart ? '?' + searchPart : '');
        }
    }]);

    return Path;
})();

exports['default'] = Path;
module.exports = exports['default'];
// regex:   match => new RegExp('(?=(\?|.*&)' + match[0] + '(?=(\=|&|$)))')