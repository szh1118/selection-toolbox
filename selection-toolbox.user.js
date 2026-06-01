// ==UserScript==
// @name         Selection Toolbox - Base64/Base32/Radix
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  选中文本后自动弹出浮动菜单，支持 Base64/Base32 编解码和进制转换，结果自动复制到剪贴板
// @author       You
// @match        *://*/*
// @grant        GM_setClipboard
// @license      CC BY-NC-SA 4.0
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    /* ───────── 自适应亮/暗色样式 ───────── */
    var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    function injectStyles() {
        var light = {
            menuBg: '#ffffff',
            menuBorder: '#d0d0d0',
            menuShadow: '0 6px 20px rgba(0,0,0,0.18)',
            itemColor: '#222',
            itemHoverBg: '#e8f0fe',
            itemHoverColor: '#174ea6',
            sepBg: '#e0e0e0',
            toastBg: '#323232',
            toastColor: '#fff',
            toastShadow: '0 4px 12px rgba(0,0,0,0.2)'
        };
        var dark = {
            menuBg: '#2b2b2b',
            menuBorder: '#4a4a4a',
            menuShadow: '0 6px 20px rgba(0,0,0,0.5)',
            itemColor: '#d4d4d4',
            itemHoverBg: '#1e3a5f',
            itemHoverColor: '#93b8f5',
            sepBg: '#444',
            toastBg: '#e0e0e0',
            toastColor: '#1a1a1a',
            toastShadow: '0 4px 12px rgba(0,0,0,0.5)'
        };
        var c = isDark ? dark : light;

        // Listen for OS theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
                isDark = e.matches;
                var nc = isDark ? dark : light;
                applyThemeVars(nc);
            });
        }

        function applyThemeVars(v) {
            [].forEach.call(document.querySelectorAll('.st-css-var'), function (el) { el.remove(); });
            var s = document.createElement('style');
            s.className = 'st-css-var';
            s.textContent = ':root {' +
                '--st-menu-bg:' + v.menuBg + ';' +
                '--st-menu-border:' + v.menuBorder + ';' +
                '--st-menu-shadow:' + v.menuShadow + ';' +
                '--st-item-color:' + v.itemColor + ';' +
                '--st-item-hover-bg:' + v.itemHoverBg + ';' +
                '--st-item-hover-color:' + v.itemHoverColor + ';' +
                '--st-sep-bg:' + v.sepBg + ';' +
                '--st-toast-bg:' + v.toastBg + ';' +
                '--st-toast-color:' + v.toastColor + ';' +
                '--st-toast-shadow:' + v.toastShadow + ';' +
            '}';
            document.head.appendChild(s);
        }
        applyThemeVars(c);

        var coreStyle = document.createElement('style');
        coreStyle.textContent = `
#st-menu {
    position: fixed;
    z-index: 2147483647;
    background: var(--st-menu-bg);
    border: 1px solid var(--st-menu-border);
    border-radius: 8px;
    box-shadow: var(--st-menu-shadow);
    padding: 6px 0;
    display: none;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    min-width: 155px;
    user-select: none;
}
#st-menu .st-item {
    padding: 7px 18px;
    cursor: pointer;
    color: var(--st-item-color);
    white-space: nowrap;
    transition: background 0.1s;
}
#st-menu .st-item:hover {
    background: var(--st-item-hover-bg);
    color: var(--st-item-hover-color);
}
#st-menu .st-sep {
    height: 1px;
    background: var(--st-sep-bg);
    margin: 4px 10px;
}
#st-toast {
    position: fixed;
    z-index: 2147483647;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--st-toast-bg);
    color: var(--st-toast-color);
    padding: 8px 22px;
    border-radius: 20px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: var(--st-toast-shadow);
}
    `;
        document.head.appendChild(coreStyle);
    }

    /* ───────── 创建 DOM ───────── */
    function createMenu() {
        const menu = document.createElement('div');
        menu.id = 'st-menu';
        document.body.appendChild(menu);
        return menu;
    }

    function createToast() {
        const toast = document.createElement('div');
        toast.id = 'st-toast';
        document.body.appendChild(toast);
        return toast;
    }

    let toastTimer = null;
    function showToast(msg, duration) {
        duration = duration || 2000;
        const toast = document.getElementById('st-toast');
        toast.textContent = msg;
        toast.style.opacity = '1';
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.style.opacity = '0';
        }, duration);
    }

    /* ───────── 剪贴板 ───────── */
    function copyToClipboard(text) {
        // 优先用 GM API
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            showToast('✓ 已复制到剪贴板');
            return;
        }
        // fallback: navigator.clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                showToast('✓ 已复制到剪贴板');
            }).catch(function () {
                fallbackCopy(text);
            });
            return;
        }
        fallbackCopy(text);
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            document.execCommand('copy');
            showToast('✓ 已复制到剪贴板');
        } catch (e) {
            showToast('✗ 复制失败');
        }
        document.body.removeChild(ta);
    }

    /* ───────── Base64 ───────── */
    function base64Encode(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            return btoa(str);
        }
    }

    function base64Decode(str) {
        str = str.replace(/\s/g, '');
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            try {
                return atob(str);
            } catch (e2) {
                throw new Error('无效的 Base64 字符串');
            }
        }
    }

    /* ───────── Base32 (RFC 4648) ───────── */
    var BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    function base32Encode(str) {
        var bytes = new TextEncoder().encode(str);
        var bits = 0;
        var value = 0;
        var result = '';
        for (var i = 0; i < bytes.length; i++) {
            value = (value << 8) | bytes[i];
            bits += 8;
            while (bits >= 5) {
                result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) {
            result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
        }
        while (result.length % 8 !== 0) {
            result += '=';
        }
        return result;
    }

    function base32Decode(str) {
        str = str.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
        if (str.length === 0) throw new Error('无效的 Base32 字符串');
        var bits = 0;
        var value = 0;
        var bytes = [];
        for (var i = 0; i < str.length; i++) {
            var idx = BASE32_ALPHABET.indexOf(str[i]);
            if (idx === -1) throw new Error('无效的 Base32 字符');
            value = (value << 5) | idx;
            bits += 5;
            while (bits >= 8) {
                bytes.push((value >>> (bits - 8)) & 255);
                bits -= 8;
            }
        }
        return new TextDecoder().decode(new Uint8Array(bytes));
    }

    /* ───────── 进制检测 ───────── */
    function parseIntegerForRadix(str) {
        var raw = str.trim().replace(/[,_\s]/g, '');
        if (!raw) throw new Error('无法识别数字格式');
        if (raw.indexOf('.') !== -1) throw new Error('进制转换仅支持整数');

        var sign = '';
        if (raw[0] === '-' || raw[0] === '+') {
            sign = raw[0] === '-' ? '-' : '';
            raw = raw.slice(1);
        }

        if (/^0x[0-9a-f]+$/i.test(raw)) {
            return { value: applySign(BigInt(raw), sign), base: 16 };
        }
        if (/^0b[01]+$/i.test(raw)) {
            return { value: applySign(BigInt(raw), sign), base: 2 };
        }
        if (/^0o[0-7]+$/i.test(raw)) {
            return { value: applySign(BigInt(raw), sign), base: 8 };
        }
        if (/^\d+$/.test(raw)) {
            return { value: applySign(BigInt(raw), sign), base: 10 };
        }
        if (/^(?=.*[a-f])[0-9a-f]+$/i.test(raw)) {
            return { value: applySign(BigInt('0x' + raw), sign), base: 16 };
        }

        throw new Error('无法识别数字格式');
    }

    function applySign(n, sign) {
        return sign === '-' ? -n : n;
    }

    function formatSignedPrefixed(n, prefix, base) {
        if (n < 0n) return '-' + prefix + (-n).toString(base);
        return prefix + n.toString(base);
    }

    function radixConvert(str) {
        var parsed = parseIntegerForRadix(str);
        var n = parsed.value;
        var lines = [];
        lines.push('输入进制 : ' + parsed.base);
        lines.push('DEC     : ' + n.toString(10));
        lines.push('HEX     : ' + formatSignedPrefixed(n, '0x', 16));
        lines.push('BIN     : ' + formatSignedPrefixed(n, '0b', 2));
        lines.push('OCT     : ' + formatSignedPrefixed(n, '0o', 8));
        return lines.join('\n');
    }

    /* ───────── 构建菜单项 ───────── */
    function buildMenu(menu) {
        var items = [
            { label: 'Base64 编码',  action: function (t) { copyToClipboard(base64Encode(t)); } },
            { label: 'Base64 解码',  action: function (t) { copyToClipboard(base64Decode(t)); } },
            { label: 'Base32 编码',  action: function (t) { copyToClipboard(base32Encode(t)); } },
            { label: 'Base32 解码',  action: function (t) { copyToClipboard(base32Decode(t)); } },
            { label: '进制转换',      action: function (t) {
                var r = radixConvert(t);
                if (r) {
                    copyToClipboard(r);
                } else {
                    showToast('无法识别数字格式', 2500);
                }
            }},
        ];

        items.forEach(function (item, idx) {
            if (idx === 4) {
                var sep = document.createElement('div');
                sep.className = 'st-sep';
                menu.appendChild(sep);
            }
            var el = document.createElement('div');
            el.className = 'st-item';
            el.textContent = item.label;
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                var sel = window.getSelection();
                var text = sel ? sel.toString().trim() : '';
                if (text) {
                    try {
                        item.action(text);
                    } catch (err) {
                        showToast('✗ ' + err.message, 2500);
                    }
                }
                hideMenu();
            });
            menu.appendChild(el);
        });
    }

    /* ───────── 显示 / 隐藏 ───────── */
    var menuEl = null;

    function hideMenu() {
        if (menuEl) menuEl.style.display = 'none';
    }

    function showMenu(x, y) {
        if (!menuEl) return;
        menuEl.style.left = x + 'px';
        menuEl.style.top = y + 'px';
        menuEl.style.display = 'block';

        // 防止溢出视口
        var rect = menuEl.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        if (rect.right > vw)  menuEl.style.left = (vw - rect.width - 8) + 'px';
        if (rect.bottom > vh) menuEl.style.top  = (vh - rect.height - 8) + 'px';
        if (rect.left < 0)   menuEl.style.left = '8px';
        if (rect.top < 0)    menuEl.style.top  = '8px';
    }

    /* ───────── 事件绑定 ───────── */
    function bindEvents() {
        document.addEventListener('mouseup', function (e) {
            setTimeout(function () {
                var sel = window.getSelection();
                var text = sel ? sel.toString().trim() : '';
                if (text.length > 0 && !e.target.closest('#st-menu')) {
                    showMenu(e.clientX + 4, e.clientY + 8);
                } else if (!e.target.closest('#st-menu')) {
                    hideMenu();
                }
            }, 15);
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#st-menu')) {
                hideMenu();
            }
        });

        document.addEventListener('scroll', function () {
            hideMenu();
        }, true);

        // 键盘 ESC 关闭
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hideMenu();
        });
    }

    /* ───────── 初始化 ───────── */
    function init() {
        injectStyles();
        var menu = createMenu();
        var toast = createToast();
        buildMenu(menu);
        menuEl = menu;
        bindEvents();
    }

    init();
})();
