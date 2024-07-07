'use strict'

// Notes:
// point = [u, v]
//   top left point = [0, point_elem_range]
//   bottom right point = [point_elem_range, 0]

//////////////////////////////////////////////////
// vars

const point_elem_range = 100
const canvas_relative_size = 0.5

// never access directly!
let placed_points = [], canceled_points = []
let prev_scale = 1

const main_canvas = Q('#main_canvas')
const main_canvas_box = Q('#main_canvas_box')

//////////////////////////////////////////////////
// init

window.onresize = set_size
new ResizeObserver(set_size).observe(main_canvas_box)
set_size()

const listener = {mousemove, mousedown, mouseenter, mouseleave}
each_key_value(listener, (key, val) => main_canvas.addEventListener(key, val))

///////////////////////////////////////////
// mouse

function mousemove(e) {update(event_point(e))}
function mouseenter(e) {mousemove(e)}
function mouseleave(e) {update()}

function mousedown(e) {
    const p = event_point(e)
    push_point(p); update(p); scroll_points_text()
}

function event_point(e) {
    const x0 = e.layerX, y0 = e.layerY
    return xy2p(mul([x0, y0], canvas_scale()))
}

///////////////////////////////////////////
// update

function update(p) {
    const corr = get_corr(), pca = get_pca()
    draw(corr, pca, p)
    update_texts(corr, p)
    update_buttons()
    update_download_link(corr)
}

function update_texts({r, a, b}, p) {
    function set_text(key, val) {Q(key).innerText = val}
    function to_text(val) {return val.toFixed(2)}
    const [at, bt] = [a, Math.abs(b)].map(to_text), b_sign = b >= 0 ? '+' : '-'
    set_text('#corr', isNaN(r) ? '' : to_text(r))
    set_text('#regression', isNaN(b) ? '' : `y = ${at} x ${b_sign} ${bt}`)
    set_text('#sample_size', get_points().length)
    set_text('#coord',  p ? `(${p})` : '')
    Q('#points_text').value = get_points_text()
}

function update_buttons() {
    function enable(queries, ready) {queries.map(q => Q(q).disabled = !ready)}
    const {undoable, redoable} = availability()
    enable(['#undo', '#undo_all', '#copy_points'], undoable)
    enable(['#redo', '#redo_all'], redoable)
}
function availability() {
    return {undoable: !empty(placed_points), redoable: !empty(canceled_points)}
}

///////////////////////////////////////////
// draw

function draw({a, b}, pca, p) {
    const g = main_canvas.getContext('2d')
    const ps = get_points(), n = ps.length, p_mean = get_mean_point()
    clear(g)
    ps.map(pt => plot_point(g, pt, 'blue'))
    plot_regression_line(g, a, b)
    plot_pca(g, pca, p_mean)
    n === 0 && big_message(g, 'Click here!', 'blue')
    n === 1 && big_message(g, 'Click more!', 'rgba(0,0,255,0.2)')
    n === 2 && big_message(g, 'More & more!', 'rgba(0,0,255,0.1)')
    n > 0 && plot_mean(g, p_mean)
    p && plot_point(g, p, n > 0 ? 'rgba(0,0,0,0.2)' : 'red')
}

function plot_mean(g, p_mean) {
    g.save()
    g.strokeStyle = 'gray'; g.lineWidth = 1; g.setLineDash([3, 3])
    cross_line(g, ...p2xy(p_mean))
    g.restore()
}

function plot_point(g, p, color) {
    g.strokeStyle = color; g.lineWidth = 2
    const radius = g.canvas.width * 0.01
    circle(g, ...p2xy(p), radius)
}

function plot_regression_line(g, a, b) {
    const u = point_elem_range
    const [x0, y0] = p2xy([0, b]), [x1, y1] = p2xy([u, a * u + b])
    g.strokeStyle = 'red'; g.lineWidth = 2
    line(g, x0, y0, x1, y1)
}

function plot_pca(g, pca, p_mean) {
    g.strokeStyle = 'rgba(255,128,0,0.2)'; g.lineWidth = 10
    const to_xy = uv => p2xy(elem_add(p_mean, uv))
    const xys = uv => [1, -1].flatMap(c => to_xy(mul(uv, c)))
    pca.forEach(uv => line(g, ...xys(uv)))
}

//////////////////////////////////////////////////
// place & undo

function push_point(p) {placed_points.push(p); canceled_points = []}
function get_points() {return placed_points}

function undo(silent) {return transfer_point(placed_points, canceled_points, silent)}
function redo(silent) {return transfer_point(canceled_points, placed_points, silent)}
function undo_all() {while(undo(true)){}; update()}
function redo_all() {while(redo(true)){}; update()}

function transfer_point(from, to, silent) {
    const p = from.pop(); if (!p) {return false}
    to.push(p); silent || update(); return true
}

///////////////////////////////////////////
// point <==> xy

function p2xy(p) {return mul(flip_v(p), p2xy_scale())}
function xy2p(xy) {
    const p = flip_v(mul(xy, 1 / p2xy_scale()))
    return digitize_point(p)
}

function p2xy_scale() {return main_canvas.width / point_elem_range}
function flip_v([u, v]) {return [u, point_elem_range - v]}
function digitize_point(p) {return p.map(digitize)}
function digitize(z) {return parseFloat(z.toFixed(2))}

///////////////////////////////////////////
// copy points to clipboard

function copy_points() {navigator.clipboard.writeText(get_points_text()); wink()}

function get_points_text() {
    const ps = get_points()
    if (empty(ps)) {return ''}
    const body = ps.map(p => `  ${JSON.stringify(p)}`).join(',\n')
    return `[\n${body}\n]`
}

function scroll_points_text() {
    const ta = Q('#points_text')
    ta.scrollTop = ta.scrollHeight
}

///////////////////////////////////////////
// download image

function update_download_link({r, a, b}) {
    function f2t(val) {return isNaN(val) ? 'NAN' : Math.round(val * 100)}
    const href = main_canvas.toDataURL('image/png')
    const n = get_points().length
    const [rt, at, bt] = [r, a, b].map(f2t)
    const download = `icorr_r${rt}_a${at}_b${bt}_n${n}_${yymmdd_HHMMSS()}.png`
    Object.assign(Q('#download'), {href, download})
}

function yymmdd_HHMMSS() {
    const now = new Date()
    function g(f) {return `0${now['get' + f]() + (f === 'Month' ? 1 : 0)}`.slice(-2)}
    function gs(...fs) {return fs.map(g).join('')}
    return gs('FullYear', 'Month', 'Date') + '_' + gs('Hours', 'Minutes', 'Seconds')
}

///////////////////////////////////////////
// canvas geom

function set_size() {
    const {clientWidth, clientHeight} = Q('html')
    const size = to_i(Math.min(clientWidth, clientHeight) * canvas_relative_size)
    set_style_size(main_canvas_box, size, size)
    copy_position(main_canvas_box, main_canvas)
    set_canvas_size(main_canvas, size, size)
    update()
}

function set_style_size(elem, width, height) {
    each_key_value({width, height}, (k, v) => set_style_px(elem, k, v))
}
function set_style_px(elem, key, val){elem.style[key] = `${val}px`}

function copy_position(from, to) {
    const rect = from.getBoundingClientRect()
    const args = [['left', 'width', 'scrollX'],
                  ['top', 'height', 'scrollY']]
    const set_pos = ([xy, wh, scroll]) => {
        const pos = rect[xy] + window[scroll]
        set_style_px(to, xy, pos)
    }
    args.forEach(set_pos)
}

function set_canvas_size(canvas, width, height) {
    set_style_size(canvas, width, height)
    const [w, h] = [width, height].map(z => to_i(z * canvas_scale()))
    canvas.width = w; canvas.height = h
}
function canvas_scale(){
    const scale = window.devicePixelRatio, changed = (prev_scale !== scale)
    prev_scale = scale
    changed && set_size()
    return scale
}

///////////////////////////////////////////
// graphics

function clear(ctx) {
    const c = ctx.canvas
    ctx.fillStyle = window.getComputedStyle(c).getPropertyValue("background-color");
    // dare to use fillRect rather than clearRect for "Download image" feature
    ctx.fillRect(0, 0, c.width, c.height)
}

function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}
function cross_line(ctx, x, y) {
    const {width, height} = ctx.canvas
    line(ctx, x, 0, x, height); line(ctx, 0, y, width, y)
}
function circle(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke()
}

function big_message(ctx, text, color) {
    ctx.save()
    ctx.font = '7vmin Arial'; ctx.fillStyle = color
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const {width, height} = ctx.canvas
    ctx.fillText(text, width / 2, height / 2)
    ctx.restore()
}

//////////////////////////////////////////////////
// correlation & PCA

function get_corr() {
    const {us, vs, std_u, std_v, cov_uv} = get_cov()
    const r = cov_uv / (std_u * std_v)
    const a = cov_uv / (std_u ** 2), b = mean(vs) - a * mean(us)
    return {r, a, b}
}
function get_cov() {
    const [us, vs] = get_us_vs()
    const [std_u, std_v] = [us, vs].map(std)
    const cov_uv = cov(us, vs)
    return {us, vs, std_u, std_v, cov_uv}
}
function get_mean_point() {return get_us_vs().map(mean)}

function get_pca() {
    const {std_u, std_v, cov_uv} = get_cov()
    const mat = [[std_u**2, cov_uv], [cov_uv, std_v**2]]
    const cook = ([lam, vec]) => mul(vec, Math.sqrt(lam))
    return eigen(mat).map(cook)
}
function eigen([[a, b], [c, d]]) {
    const tr = a + d, det = a * d - b * c
    const sq = Math.sqrt(tr**2 - 4 * det)
    const lam1 = (tr + sq) / 2, lam2 = (tr - sq) / 2
    const [vec1, vec2] = [[b, lam1 - a], [lam2 - d, c]].map(normalize)
    return [[lam1, vec1], [lam2, vec2]]
}

function get_us_vs() {
    const ps = get_points()
    return [0, 1].map(k => ps.map(p => p[k]))
}
function cov(us, vs) {
    const [mean_u, mean_v] = [us, vs].map(mean)
    return mean(elem_prod(sub(us, mean_u), sub(vs, mean_v)))
}
function std(a) {return Math.sqrt(cov(a, a))}

///////////////////////////////////////////
// util

function Q(selector) {return document.querySelector(selector)}

let last_wink_animation = null
function wink() {
    const keyframes = [{scale: 1}, {scale: 0.8}, {scale: 1}]
    // const keyframes = [{opacity: 1}, {opacity: 0.3}, {opacity: 1}]
    last_wink_animation && last_wink_animation.finish()
    last_wink_animation = Q('#points_text').animate(keyframes, 200)
}

function to_i(x) {return x | 0}
function each_key_value(h, f){Object.keys(h).forEach(k => f(k, h[k]))}

// array util
function empty(a) {return a.length === 0}
function sum(a) {return a.reduce((acc, z) => acc + z, 0)}
function mean(a) {return sum(a) / a.length}
function sub(a, c) {return a.map(z => z - c)}
function mul(a, c) {return a.map(z => z * c)}
function elem_gen(a, b, op) {return a.map((_, k) => op(a[k], b[k]))}
function elem_prod(a, b) {return elem_gen(a, b, (s, t) => s * t)}
function elem_add(a, b) {return elem_gen(a, b, (s, t) => s + t)}

function inner(a, b) {return sum(elem_prod(a, b))}
function norm(a) {return Math.sqrt(inner(a, a))}
function normalize(a) {return mul(a, 1 / (norm(a) + 1e-8))}
