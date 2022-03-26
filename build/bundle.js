var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\components\Word.svelte generated by Svelte v3.46.4 */

    function create_fragment$4(ctx) {
    	let div;
    	let h1;
    	let t;

    	return {
    		c() {
    			div = element("div");
    			h1 = element("h1");
    			t = text(/*word*/ ctx[0]);
    			attr(h1, "class", "word svelte-1dvx91m");
    			attr(div, "class", "word-container svelte-1dvx91m");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h1);
    			append(h1, t);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*word*/ 1) set_data(t, /*word*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { word = "" } = $$props;

    	$$self.$$set = $$props => {
    		if ('word' in $$props) $$invalidate(0, word = $$props.word);
    	};

    	return [word];
    }

    class Word extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$4, safe_not_equal, { word: 0 });
    	}
    }

    /* src\components\Typer.svelte generated by Svelte v3.46.4 */

    function create_fragment$3(ctx) {
    	let div;
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			attr(input, "placeholder", "Type...");
    			attr(input, "spellcheck", "false");
    			attr(input, "class", "input svelte-1psioqd");
    			attr(input, "name", "input");
    			attr(input, "id", "input");
    			attr(div, "class", "input-container svelte-1psioqd");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*texty*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[4]),
    					listen(input, "keyup", /*send*/ ctx[1])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*texty*/ 1 && input.value !== /*texty*/ ctx[0]) {
    				set_input_value(input, /*texty*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { word = "" } = $$props;
    	let { appreciation = "" } = $$props;
    	const dispatch = createEventDispatcher();
    	let texty = "";

    	function send() {
    		dispatch("message", { text: texty });

    		if (texty === word || appreciation !== "") {
    			$$invalidate(0, texty = "");
    		}
    	}

    	function input_input_handler() {
    		texty = this.value;
    		$$invalidate(0, texty);
    	}

    	$$self.$$set = $$props => {
    		if ('word' in $$props) $$invalidate(2, word = $$props.word);
    		if ('appreciation' in $$props) $$invalidate(3, appreciation = $$props.appreciation);
    	};

    	return [texty, send, word, appreciation, input_input_handler];
    }

    class Typer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, { word: 2, appreciation: 3 });
    	}
    }

    /* src\components\Score.svelte generated by Svelte v3.46.4 */

    function create_else_block(ctx) {
    	let h1;
    	let t;

    	return {
    		c() {
    			h1 = element("h1");
    			t = text(/*appreciation*/ ctx[2]);
    			attr(h1, "class", "message svelte-1jt29j4");
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    			append(h1, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*appreciation*/ 4) set_data(t, /*appreciation*/ ctx[2]);
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    		}
    	};
    }

    // (32:2) {#if !appreciation}
    function create_if_block(ctx) {
    	let h1;
    	let t;

    	return {
    		c() {
    			h1 = element("h1");
    			t = text(/*handle*/ ctx[3]);
    			attr(h1, "class", "message svelte-1jt29j4");
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    			append(h1, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*handle*/ 8) set_data(t, /*handle*/ ctx[3]);
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let t0;
    	let div0;
    	let h10;
    	let t1;
    	let t2;
    	let t3;
    	let h11;
    	let t4;
    	let t5;

    	function select_block_type(ctx, dirty) {
    		if (!/*appreciation*/ ctx[2]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div1 = element("div");
    			if_block.c();
    			t0 = space();
    			div0 = element("div");
    			h10 = element("h1");
    			t1 = text("Time left: ");
    			t2 = text(/*time*/ ctx[0]);
    			t3 = space();
    			h11 = element("h1");
    			t4 = text("Score: ");
    			t5 = text(/*score*/ ctx[1]);
    			attr(h10, "class", "time svelte-1jt29j4");
    			attr(h11, "class", "score svelte-1jt29j4");
    			attr(div0, "class", "info-container svelte-1jt29j4");
    			attr(div1, "class", "more svelte-1jt29j4");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			if_block.m(div1, null);
    			append(div1, t0);
    			append(div1, div0);
    			append(div0, h10);
    			append(h10, t1);
    			append(h10, t2);
    			append(div0, t3);
    			append(div0, h11);
    			append(h11, t4);
    			append(h11, t5);
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t0);
    				}
    			}

    			if (dirty & /*time*/ 1) set_data(t2, /*time*/ ctx[0]);
    			if (dirty & /*score*/ 2) set_data(t5, /*score*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_block.d();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { time = 5 } = $$props;
    	let { score = 0 } = $$props;
    	let { appreciation = "" } = $$props;
    	let { handle = "" } = $$props;

    	$$self.$$set = $$props => {
    		if ('time' in $$props) $$invalidate(0, time = $$props.time);
    		if ('score' in $$props) $$invalidate(1, score = $$props.score);
    		if ('appreciation' in $$props) $$invalidate(2, appreciation = $$props.appreciation);
    		if ('handle' in $$props) $$invalidate(3, handle = $$props.handle);
    	};

    	return [time, score, appreciation, handle];
    }

    class Score extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$1, create_fragment$2, safe_not_equal, {
    			time: 0,
    			score: 1,
    			appreciation: 2,
    			handle: 3
    		});
    	}
    }

    /* src\components\Notice.svelte generated by Svelte v3.46.4 */

    function create_fragment$1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");

    			div.innerHTML = `<h1 class="title svelte-1ulwvfd">Notice</h1>  
    <p class="notice svelte-1ulwvfd">Type each word in the given amount of seconds to score. To play again, press any key then type the current word. Your score
        will reset.</p>`;

    			attr(div, "class", "notice-container svelte-1ulwvfd");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    class Notice extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.4 */

    function create_fragment(ctx) {
    	let div1;
    	let div0;
    	let t1;
    	let word_1;
    	let t2;
    	let typer;
    	let t3;
    	let score_1;
    	let t4;
    	let notice;
    	let current;
    	word_1 = new Word({ props: { word: /*word*/ ctx[0] } });

    	typer = new Typer({
    			props: {
    				word: /*word*/ ctx[0],
    				appreciation: /*appreciation*/ ctx[3]
    			}
    		});

    	typer.$on("message", /*receive*/ ctx[5]);

    	score_1 = new Score({
    			props: {
    				time: /*time*/ ctx[1],
    				score: /*score*/ ctx[2],
    				appreciation: /*appreciation*/ ctx[3],
    				handle: /*handle*/ ctx[4]
    			}
    		});

    	notice = new Notice({});

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.innerHTML = `<h1 class="title svelte-zy1i5n">Typing Speed</h1>`;
    			t1 = space();
    			create_component(word_1.$$.fragment);
    			t2 = space();
    			create_component(typer.$$.fragment);
    			t3 = space();
    			create_component(score_1.$$.fragment);
    			t4 = space();
    			create_component(notice.$$.fragment);
    			attr(div0, "class", "title-container svelte-zy1i5n");
    			attr(div1, "class", "container svelte-zy1i5n");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div1, t1);
    			mount_component(word_1, div1, null);
    			append(div1, t2);
    			mount_component(typer, div1, null);
    			append(div1, t3);
    			mount_component(score_1, div1, null);
    			append(div1, t4);
    			mount_component(notice, div1, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const word_1_changes = {};
    			if (dirty & /*word*/ 1) word_1_changes.word = /*word*/ ctx[0];
    			word_1.$set(word_1_changes);
    			const typer_changes = {};
    			if (dirty & /*word*/ 1) typer_changes.word = /*word*/ ctx[0];
    			if (dirty & /*appreciation*/ 8) typer_changes.appreciation = /*appreciation*/ ctx[3];
    			typer.$set(typer_changes);
    			const score_1_changes = {};
    			if (dirty & /*time*/ 2) score_1_changes.time = /*time*/ ctx[1];
    			if (dirty & /*score*/ 4) score_1_changes.score = /*score*/ ctx[2];
    			if (dirty & /*appreciation*/ 8) score_1_changes.appreciation = /*appreciation*/ ctx[3];
    			if (dirty & /*handle*/ 16) score_1_changes.handle = /*handle*/ ctx[4];
    			score_1.$set(score_1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(word_1.$$.fragment, local);
    			transition_in(typer.$$.fragment, local);
    			transition_in(score_1.$$.fragment, local);
    			transition_in(notice.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(word_1.$$.fragment, local);
    			transition_out(typer.$$.fragment, local);
    			transition_out(score_1.$$.fragment, local);
    			transition_out(notice.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(word_1);
    			destroy_component(typer);
    			destroy_component(score_1);
    			destroy_component(notice);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let word = "";
    	let time = 5;
    	let starting = true;
    	let score = 0;
    	let answer = "";
    	let appreciation = "";
    	let handle = "";
    	let interval;
    	let data = [];

    	onMount(async () => {
    		const response = await fetch("https://random-word-api.herokuapp.com/word?number=300");
    		data = await response.json();
    		createWord();
    	});

    	function receive(e) {
    		$$invalidate(3, appreciation = "");
    		$$invalidate(4, handle = "");
    		answer = e.detail.text;

    		if (starting) {
    			$$invalidate(2, score = 0);
    			$$invalidate(1, time = 5);

    			interval = setInterval(
    				() => {
    					$$invalidate(1, time--, time);

    					if (time < 1) {
    						clearInterval(interval);
    						starting = true;
    						lost();
    					}
    				},
    				1000
    			);

    			starting = false;
    		}

    		if (answer === word && time > 0) {
    			createWord();
    			$$invalidate(4, handle = "Correct");
    			$$invalidate(1, time = 5);
    			$$invalidate(2, score++, score);
    		}
    	}

    	function lost() {
    		if (score > 30) {
    			$$invalidate(3, appreciation = "excuse me are you a boot");
    		} else if (score > 20) {
    			$$invalidate(3, appreciation = "hacker");
    		} else if (score > 15) {
    			$$invalidate(3, appreciation = "exellent");
    		} else if (score > 10) {
    			$$invalidate(3, appreciation = "Very Good");
    		} else if (score > 7) {
    			$$invalidate(3, appreciation = "Good");
    		} else if (score > 3) {
    			$$invalidate(3, appreciation = "Good for a bigginer");
    		} else if (score >= 0) {
    			$$invalidate(3, appreciation = "You can do better");
    		} else {
    			$$invalidate(3, appreciation = "");
    		}
    	}

    	function createWord() {
    		let random = Math.floor(Math.random() * data.length);
    		$$invalidate(0, word = data[random]);
    	}

    	return [word, time, score, appreciation, handle, receive];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
