self.rerere && (function(chrome) {
    'use strict';

    const manifest = chrome.runtime.getManifest();
    const production = manifest.version !== '109101.103.97';
    const baseURL = chrome.extension.getURL(production ? 'mega/secure.html' : 'webclient/index.html');

    const extPassTh = {
        '.xml': 1,
        '.crx': 1,
        '.xpi': 1,
        '.exe': 1,
        '.dmg': 1,
        '.deb': 1,
        '.rpm': 1,
        '.zip': 1,
        '.txt': 1,
        '.pdf': 1,
        '.js': 1,
        '.gz': 1
    };

    const qsMap = v => String(v || '').replace(/[&?]/g, '/');

    const getPathHash = (aUrl, aDefValue) => {
        try {
            const uri = new URL(aUrl);
            return uri.pathname.substr(1) + qsMap(uri.search) + uri.hash;
        }
        catch (ex) {}

        return qsMap(aDefValue);
    };

    const onBeforeRequest = (aRequest) => {
        const url = aRequest.url;
        const ext3 = url.substr(-3);
        const ext4 = url.substr(-4);

        if (extPassTh[ext3] || extPassTh[ext4] || url.indexOf('mega.nz/linux') > 0) {
            return {cancel: false};
        }

        let hash = '';
        const domain = (url.match(/:\/\/[^/]+\//) || [''])[0];
        const cleanDomain = domain.replace(/www\.|co\./g, '');

        if (cleanDomain === '://mega.nz/' || cleanDomain === '://mega.io/') {
            const path = url.split(domain)[1];

            if (/^\/*(?:chat|file|folder|help)\//.test(path)) {
                hash = '#' + getPathHash(url, path);
            }
            else if (url.indexOf('#') > -1) {
                const nlfe = url.match(/\/\/mega\.nz\/+(embed|drop|filerequest)[!#/]+([\w-]{8,11})(?:[#!](.*))?/i);

                if (nlfe) {
                    let type = nlfe[1];
                    let node = nlfe[2];
                    let pkey = nlfe[3];
                    let lpfx = ({embed: 'E', drop: 'D', filerequest: 'D'})[type] || '';

                    hash = '#' + lpfx + '!' + node + (pkey ? '!' + pkey : '');
                }
                else {
                    hash = '#' + url.split('#')[1];
                }
            }
            else if (path) {
                hash = '#' + (path.indexOf('?') !== -1 ? getPathHash(url, path) : path);
            }
        }
        return {redirectUrl: baseURL + hash};
    };

    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest,
        {
            urls: [
                "http://mega.co.nz/*",
                "https://mega.co.nz/*",
                "http://www.mega.co.nz/*",
                "https://www.mega.co.nz/*",
                "http://mega.nz/*",
                "https://mega.nz/*",
                "http://www.mega.nz/*",
                "https://www.mega.nz/*"
            ],
            types: ["main_frame", "sub_frame"]
        },
        ["blocking"]
    );

    if (!production) {
        const extURL = chrome.runtime.getURL('/');

        chrome.webRequest.onBeforeRequest.addListener(
            (aRequest) => {
                let target = false;
                let path = aRequest.url.replace(extURL, '');

                if (path === 'secureboot.js') {
                    target = extURL + 'webclient/secureboot.js';
                }
                else if (path === 'mega/secure.html') {
                    target = baseURL;
                }
                else if (path.substr(0, 5) === 'mega/') {
                    if (path.substr(0, 10) === 'mega/lang/') {
                        path = path.replace('.json', '_prod.json');
                    }
                    target = extURL + path.replace('mega/', 'webclient/');
                }

                // console.log('redirectUrl', aRequest.url, target);
                return target ? {redirectUrl: target} : {cancel: false};
            },
            {
                urls: [chrome.extension.getURL('/*')],
                types: ['main_frame', 'sub_frame', 'image', 'script', 'xmlhttprequest', 'other']
            },
            ["blocking"]
        );
    }

    chrome.browserAction.onClicked.addListener(() => {
        chrome.tabs.create({url: manifest.homepage_url + (production ? '' : '#debug')});
    });
    chrome.browserAction.setTitle({
        title: '' + manifest.name + ' v' + manifest.version + (production ? '' : ' (development)')
    });

})(self.browser || self.chrome);

(function(chrome) {
    'use strict';

    const manifest = chrome.runtime.getManifest();
    const production = manifest.version !== '109101.103.97';
    const baseURL = chrome.runtime.getURL(`${production ? 'mega' : 'webclient'}/secure.html`);

    const extPassTh = {
        '.json': 1,
        '.xml': 1,
        '.crx': 1,
        '.xpi': 1,
        '.exe': 1,
        '.dmg': 1,
        '.deb': 1,
        '.rpm': 1,
        '.zip': 1,
        '.txt': 1,
        '.pdf': 1,
        '.js': 1,
        '.gz': 1
    };
    const erx = Object.keys(extPassTh).join('').split('.').slice(1).join('|');

    const rules = [
        {
            action: {
                type: "redirect",
                redirect: {
                    regexSubstitution: `${baseURL}#\\1`
                }
            },
            condition: {
                regexFilter: "^https://[^/]+/(.*)$",
                resourceTypes: [
                    "sub_frame",
                    "main_frame"
                ]
            },
            priority: 15
        },
        {
            action: {
                type: "allow"
            },
            condition: {
                urlFilter: "||mega.nz/linux",
                resourceTypes: [
                    "main_frame"
                ]
            },
            priority: 31
        },
        {
            action: {
                type: "allow"
            },
            condition: {
                regexFilter: `\\.(?:${erx})(?:\\?.*)?$`,
                resourceTypes: [
                    "main_frame"
                ]
            },
            priority: 31
        }
    ];

    if (!production) {
        const extURL = chrome.runtime.getURL('/');

        chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((p) => {
            console.log(' --- matched rule', p);
        });
    }

    ((factory) => {
        chrome.runtime.onStartup.addListener(factory);
        chrome.runtime.onInstalled.addListener(factory);
    })(async () => {
        let pid = -Math.log(Math.random()) * 0x1000000 >>> 0;
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: rules.map((rule) => {
                rule.id = ++pid;
                rule.condition.requestDomains = manifest.host_permissions.map(u => u.split('/')[2]);
                return rule;
            }),
            removeRuleIds: existingRules.map((rule) => rule.id)
        })
        console.log('Updated dynamic rules...', {existingRules, rules});
    })

    chrome.action.onClicked.addListener(() => {
        chrome.tabs.create({url: manifest.homepage_url + (production ? '' : '#debug')});
    });
    chrome.action.setTitle({
        title: '' + manifest.name + ' v' + manifest.version + (production ? '' : ' (development)')
    });

})(self.browser || self.chrome);
