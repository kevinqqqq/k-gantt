import date_utils from './date_utils';
import { $, createSVG } from './svg_utils';
import Bar from './bar';
import Arrow from './arrow';
import Popup from './popup';
import Dimension from './dimension';

import './gantt.scss';

const VIEW_MODE = {
    HOUR: 'Hour',
    QUARTER_DAY: 'Quarter Day',
    HALF_DAY: 'Half Day',
    DAY: 'Day',
    WEEK: 'Week',
    MONTH: 'Month',
    Quarterly_Month: 'Quarterly Month',
    QUARTERLY: 'Quarterly',
    YEAR: 'Year'
};

export default class Gantt {
    constructor(wrapper, tasks, options) {
        let that = this;
        this.touch =
            'ontouchstart' in window ||
            (window.DocumentTouch && document instanceof DocumentTouch);
        this.setup_wrapper(wrapper);
        this.setup_options(options);
        this.setup_dimension(tasks);
        this.setup_tasks(tasks);
        // initialize with default view mode
        this.change_view_mode();
        this.bind_events();

        if (!this.touch) this.bind_container_events();
        else this.bind_container_events_mobile();
        that.elX = 0;
        that.elY = 0;
        this.$container.addEventListener(
            'mousemove',
            function(event) {
                var event = event || window.event;
                that.elX = event.clientX || event.pageX;
                that.elY = event.clientY || event.pageY;
            },
            false
        );
    }

    setup_wrapper(element) {
        let svg_element, wrapper_element;

        // CSS Selector is passed
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        // get the SVGElement
        if (element instanceof HTMLElement) {
            wrapper_element = element;
            svg_element = element.querySelector('svg');
        } else if (element instanceof SVGElement) {
            svg_element = element;
        } else {
            throw new TypeError(
                'Frappé Gantt only supports usage of a string CSS selector,' +
                    " HTML DOM element or SVG DOM element for the 'element' parameter"
            );
        }

        // svg element
        if (!svg_element) {
            // create it
            this.$svg = createSVG('svg', {
                append_to: wrapper_element,
                class: 'gantt'
            });
        } else {
            this.$svg = svg_element;
            this.$svg.classList.add('gantt');
        }

        // wrapper element
        this.$container = document.createElement('div');
        this.$container.classList.add('gantt-container');

        //右侧task部分
        this.$taskinfo = document.createElement('div');
        this.$taskinfo.classList.add('task-info-wrapper');
        this.$container.appendChild(this.$taskinfo);

        this.$taskinfo_header = document.createElement('div');
        this.$taskinfo_header.classList.add('task-info-header-wrapper');
        this.$taskinfo.appendChild(this.$taskinfo_header);
        this.$svg_data_header = createSVG('svg', {
            append_to: this.$taskinfo_header,
            class: 'gantt'
        });

        this.$taskinfo_content = document.createElement('div');
        this.$taskinfo_content.classList.add('task-info-content-wrapper');
        this.$taskinfo.appendChild(this.$taskinfo_content);
        this.$svg_data_content = createSVG('svg', {
            append_to: this.$taskinfo_content,
            class: 'gantt'
        });

        //右侧task部分
        this.$task = document.createElement('div');
        this.$task.classList.add('task-wrapper');
        this.$container.appendChild(this.$task);

        this.$task_header = document.createElement('div');
        this.$task_header.classList.add('task-header-wrapper');
        this.$svg_header = createSVG('svg', {
            append_to: this.$task_header,
            class: 'gantt'
        });

        this.$task.appendChild(this.$task_header);
        this.$task_content = document.createElement('div');
        this.$task_content.classList.add('task-content-wrapper');
        this.$task.appendChild(this.$task_content);

        const parent_element = this.$svg.parentElement;
        parent_element.appendChild(this.$container);
        this.$task_content.appendChild(this.$svg);

        // popup wrapper
        this.popup_wrapper = document.createElement('div');
        this.popup_wrapper.classList.add('popup-wrapper');
        this.$task_content.appendChild(this.popup_wrapper);
    }

    setup_options(options) {
        const default_options = {
            // column_width: 30,
            columns: null,
            step: 24,
            view_modes: [...Object.values(VIEW_MODE)],
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Day',
            date_format: 'YYYY-MM-DD',
            popup_trigger: this.touch ? ' click touchstart' : 'mousemove',
            custom_popup_html: null,
            language: 'en',
            bar_drag: false //任务列表的拖动功能
        };
        this.options = Object.assign({}, default_options, options);
    }

    setup_tasks(tasks) {
        // prepare tasks
        this.tasks = tasks.map((task, i) => {
            // convert to Date objects
            task._start = date_utils.parse(task.start);
            task._end = date_utils.parse(task.end);

            // make task invalid if duration too large
            if (date_utils.diff(task._end, task._start, 'year') > 10) {
                task.end = null;
            }

            // cache index
            task._index = i;

            // invalid dates
            if (!task.start && !task.end) {
                const today = date_utils.today();
                task._start = today;
                task._end = date_utils.add(today, 2, 'day');
            }

            if (!task.start && task.end) {
                task._start = date_utils.add(task._end, -2, 'day');
            }

            if (task.start && !task.end) {
                task._end = date_utils.add(task._start, 2, 'day');
            }

            // if hours is not set, assume the last day is full day
            // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
            const task_end_values = date_utils.get_date_values(task._end);
            if (task_end_values.slice(3).every(d => d === 0)) {
                task._end = date_utils.add(task._end, 24, 'hour');
            }

            // invalid flag
            if (!task.start || !task.end) {
                task.invalid = true;
            }

            // dependencies
            if (typeof task.dependencies === 'string' || !task.dependencies) {
                let deps = [];
                if (task.dependencies) {
                    deps = task.dependencies
                        .split(',')
                        .map(d => d.trim())
                        .filter(d => d);
                }
                task.dependencies = deps;
            }

            // uids
            if (!task.id) {
                task.id = generate_id(task);
            }

            return task;
        });

        this.setup_dependencies();
    }

    setup_dimension(tasks) {
        //            const bar = new Bar(this, task);
        let dimension = new Dimension(
            this,
            tasks,
            this.options.columns,
            this.$svg_data_header,
            this.$svg_data_content
        );
        this.$taskinfo.style.width = dimension.content_width + 'px';
        this.$task.style.left = dimension.content_width + 1 + 'px';
        this.$task.style.width =
            'calc( 100% - ' + dimension.content_width + 'px )';
    }

    setup_dependencies() {
        this.dependency_map = {};
        for (let t of this.tasks) {
            for (let d of t.dependencies) {
                this.dependency_map[d] = this.dependency_map[d] || [];
                this.dependency_map[d].push(t.id);
            }
        }
    }

    refresh(tasks) {
        this.setup_tasks(tasks);
        this.change_view_mode();
    }

    change_view_mode(mode) {
        if (mode == this.options.view_mode) return;
        mode = mode || this.options.view_mode;
        this.update_view_scale(mode);
        this.setup_dates();
        this.render();
        // fire viewmode_change event
        this.trigger_event('view_change', [mode]);
    }

    update_view_scale(view_mode) {
        this.options.view_mode = view_mode;
        if (view_mode === VIEW_MODE.HOUR) {
            this.options.step = 24 / 24;
            this.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.DAY) {
            this.options.step = 24;
            this.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.HALF_DAY) {
            this.options.step = 24 / 2;
            this.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.QUARTER_DAY) {
            this.options.step = 24 / 4;
            this.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.WEEK) {
            this.options.step = 24;
            this.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.MONTH) {
            this.options.step = 24 * 30;
            this.options.column_width = 120;
        } else if (view_mode === VIEW_MODE.Quarterly_Month) {
            this.options.step = 24 * 30;
            this.options.column_width = 120;
        } else if (view_mode === VIEW_MODE.YEAR) {
            this.options.step = 24 * 365;
            this.options.column_width = 120;
        } else if (view_mode === VIEW_MODE.QUARTERLY) {
            this.options.step = 24 * 365;
            this.options.column_width = 120;
        }
    }

    setup_dates() {
        this.setup_gantt_dates();
        this.setup_date_values();
    }

    setup_gantt_dates() {
        this.gantt_start = this.gantt_end = null;

        for (let task of this.tasks) {
            // set global start and end date
            if (!this.gantt_start || task._start < this.gantt_start) {
                this.gantt_start = task._start;
            }
            if (!this.gantt_end || task._end > this.gantt_end) {
                this.gantt_end = task._end;
            }
        }

        this.gantt_start = date_utils.start_of(this.gantt_start, 'day');
        this.gantt_end = date_utils.start_of(this.gantt_end, 'day');

        let taskWidth = this.$task.offsetWidth;
        // add date padding on both sides
        if (
            this.view_is([
                VIEW_MODE.HOUR,
                VIEW_MODE.QUARTER_DAY,
                VIEW_MODE.HALF_DAY
            ])
        ) {
            this.gantt_start = date_utils.add(this.gantt_start, -7, 'day');
            this.gantt_end = date_utils.add(this.gantt_end, 7, 'day');
        } else if (this.view_is(VIEW_MODE.MONTH)) {
            this.gantt_start = date_utils.start_of(this.gantt_start, 'year');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'year');
            this.gantt_end.setMonth(10);
            this.gantt_end.setDate(30);
        } else if (this.view_is(VIEW_MODE.YEAR)) {
            this.gantt_start = date_utils.add(this.gantt_start, -2, 'year');
            this.gantt_start.setMonth(0);
            this.gantt_start.setDate(1);
            // 根据宽度动态计算，界面过宽引起区域留白
            var lastend = taskWidth / 120 / 2;
            if (lastend > 5) {
                lastend = lastend - 3;
            }
            this.gantt_end = date_utils.add(this.gantt_end, lastend, 'year');
            this.gantt_end.setMonth(5);
            this.gantt_end.setDate(31);
        } else if (this.view_is(VIEW_MODE.Quarterly_Month)) {
            this.gantt_start = date_utils.start_of(this.gantt_start, 'year');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'year');
            this.gantt_end.setMonth(10);
            this.gantt_end.setDate(30);
        } else if (this.view_is([VIEW_MODE.QUARTERLY])) {
            // this.gantt_start = date_utils.add(this.gantt_start, -1, 'year');
            // 根据宽度动态计算，界面过宽引起区域留白
            this.gantt_start.setMonth(0);
            this.gantt_start.setDate(1);
            var lastend = taskWidth / 120 / 4;
            if (lastend > 4) {
                lastend = lastend - 1;
            }
            this.gantt_end = date_utils.add(this.gantt_end, lastend, 'year');
            this.gantt_end.setMonth(8);
            this.gantt_end.setDate(31);
        } else {
            this.gantt_start = date_utils.add(this.gantt_start, -1, 'month');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'month');
        }
    }

    setup_date_values() {
        this.dates = [];
        let cur_date = null;

        while (cur_date === null || cur_date < this.gantt_end) {
            if (!cur_date) {
                cur_date = date_utils.clone(this.gantt_start);
            } else {
                if (this.view_is(VIEW_MODE.YEAR)) {
                    cur_date = date_utils.add(cur_date, 6, 'month');
                } else if (this.view_is([VIEW_MODE.QUARTERLY])) {
                    cur_date = date_utils.add(cur_date, 3, 'month');
                } else if (
                    this.view_is([VIEW_MODE.MONTH, VIEW_MODE.Quarterly_Month])
                ) {
                    cur_date = date_utils.add(cur_date, 1, 'month');
                } else if (this.view_is([VIEW_MODE.WEEK])) {
                    cur_date = date_utils.add(cur_date, 1, 'day');
                } else {
                    cur_date = date_utils.add(
                        cur_date,
                        this.options.step,
                        'hour'
                    );
                }
            }
            this.dates.push(cur_date);
        }
    }

    bind_events() {
        // this.bind_grid_click();
        // this.bind_bar_events();

        $.on(this.$svg, this.options.popup_trigger, e => {
            if (['grid-row'].indexOf(e.target.className.baseVal) > -1) {
                this.unselect_all();
                this.hide_popup();
            }
        });
        $.on(this.$svg_header, this.options.popup_trigger, () => {
            this.unselect_all();
            this.hide_popup();
        });
        $.on(this.$svg_data_content, this.options.popup_trigger, () => {
            this.unselect_all();
            this.hide_popup();
        });
    }

    render() {
        this.clear();
        this.setup_layers();
        this.make_grid();
        this.make_dates();
        this.make_bars();
        this.make_arrows();
        this.map_arrows_on_bars();
        this.set_width();
        this.set_scroll_position();
    }

    setup_layers() {
        this.layers = {};
        // const layers = ['grid', 'date', 'arrow', 'progress', 'bar', 'details'];
        const layers = ['grid', 'arrow', 'progress', 'bar', 'details'];
        // make group layers
        for (let layer of layers) {
            this.layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.$svg
            });
        }

        this.layers['date'] = createSVG('g', {
            class: 'date',
            append_to: this.$svg_header
        });
    }

    make_grid() {
        this.make_grid_background();
        this.make_grid_rows();
        // this.make_grid_header();
        this.make_grid_ticks();
        this.make_grid_highlights();
    }

    make_grid_background() {
        const grid_width = this.dates.length * this.options.column_width;
        const grid_height =
            (this.options.bar_height + this.options.padding) *
            this.tasks.length;

        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.layers.grid
        });

        $.attr(this.$svg, {
            height: grid_height,
            width: '100%'
        });
    }

    make_grid_rows() {
        const rows_layer = createSVG('g', { append_to: this.layers.grid });
        const lines_layer = createSVG('g', { append_to: this.layers.grid });

        const row_width = this.dates.length * this.options.column_width;
        const row_height = this.options.bar_height + this.options.padding;

        let row_y = 0; //this.options.padding / 2;
        for (let task of this.tasks) {
            createSVG('rect', {
                x: 0,
                y: row_y,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                append_to: rows_layer
            });

            createSVG('line', {
                x1: 0,
                y1: row_y + row_height,
                x2: row_width,
                y2: row_y + row_height,
                class: 'row-line',
                append_to: lines_layer
            });

            row_y += this.options.bar_height + this.options.padding;
        }
        createSVG('line', {
            x1: 0,
            y1: row_y,
            x2: row_width,
            y2: row_y,
            class: 'row-line',
            append_to: lines_layer
        });
    }

    make_grid_header() {
        const header_width = this.dates.length * this.options.column_width;
        createSVG('rect', {
            x: 0,
            y: 0,
            width: header_width,
            height: 0,
            class: 'grid-header',
            append_to: this.layers.grid
        });
    }

    make_grid_ticks() {
        let tick_x = 0;
        let tick_y = 0; //this.options.padding / 2;
        let tick_height =
            (this.options.bar_height + this.options.padding) *
            this.tasks.length;

        for (let date of this.dates) {
            let tick_class = 'tick';
            // thick tick for monday
            if (this.view_is(VIEW_MODE.DAY) && date.getDate() === 1) {
                tick_class += ' thick';
            }
            // thick tick for first week
            if (
                this.view_is(VIEW_MODE.WEEK) &&
                date.getDate() >= 1 &&
                date.getDate() < 8
            ) {
                tick_class += ' thick';
            }
            // thick ticks for quarters
            if (
                this.view_is(VIEW_MODE.MONTH) &&
                (date.getMonth() + 1) % 3 === 0
            ) {
                tick_class += ' thick';
            }

            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: tick_class,
                append_to: this.layers.grid
            });

            // if (this.view_is(VIEW_MODE.MONTH)) {
            //     tick_x +=
            //         date_utils.get_days_in_month(date) *
            //         this.options.column_width /
            //         30;
            // } else
            {
                tick_x += this.options.column_width;
            }
        }
    }

    make_grid_highlights() {
        // highlight today's date
        if (this.view_is(VIEW_MODE.DAY)) {
            const x =
                date_utils.diff(date_utils.today(), this.gantt_start, 'hour') /
                this.options.step *
                this.options.column_width;
            const y = 0;

            const width = this.options.column_width;
            const height =
                (this.options.bar_height + this.options.padding) *
                    this.tasks.length +
                0; //this.options.padding / 2;

            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: this.layers.grid
            });
        }
    }

    make_dates() {
        createSVG('line', {
            x1: 0,
            y1: 36,
            x2: 0,
            y2: 72,
            class: 'row-line',
            append_to: this.layers.date
        });

        for (let date of this.get_dates_to_draw()) {
            createSVG('text', {
                x: date.lower_x,
                y: date.lower_y,
                innerHTML: date.lower_text,
                class: 'lower-text',
                append_to: this.layers.date
            });

            createSVG('line', {
                x1: date.lower_x + date.lower_padding,
                y1: 36,
                x2: date.lower_x + date.lower_padding,
                y2: 72,
                class: 'row-line',
                append_to: this.layers.date
            });

            if (date.upper_text) {
                var offsetx = 0;
                var textoffsetx = 0;
                // upper居中的问题
                switch (this.options.view_mode) {
                    case 'Week': {
                        switch (date.lower_text) {
                            case '一': {
                                break;
                            }
                            case '二': {
                                break;
                            }
                            case '三': {
                                offsetx = 0 - this.options.column_width * 2 ;
                                break;
                            }
                            case '四': {
                                // date.upper_text = '';
                                textoffsetx = 0 - this.options.column_width * 2 ;
                                offsetx = 0 - this.options.column_width * 3 ;
                                break;
                            }
                            case '五': {
                                date.upper_text = '';
                                offsetx = 0 - this.options.column_width * 4 ;
                                break;
                            }
                            case '六': {
                                date.upper_text = '';
                                offsetx = 0 - this.options.column_width * 5 ;
                                break;
                            }
                            case '日': {
                                date.upper_text = '';
                                offsetx = 0 - this.options.column_width * 6 ;
                                break;
                            }
                        }
                        break;
                    }
                    case 'Day': {
                        if (date.lower_text != 1) {
                            date.upper_x -=
                                parseInt(date.lower_text) *
                                this.options.column_width;
                        }
                        switch (date.month) {
                            case 1:
                            case 3:
                            case 5:
                            case 7:
                            case 8:
                            case 10:
                            case 12:
                                offsetx = this.options.column_width;
                                break;
                            case 2:
                                var day = date_utils.get_days_in_month(
                                    new Date(
                                        ...[date.year, date.month, date.day]
                                    )
                                );
                                if (day == 28) {
                                    offsetx = 0 - this.options.column_width * 2;
                                } else {
                                    offsetx = 0 - this.options.column_width;
                                }
                                break;
                        }
                    }
                    // case 'Year': {
                    //     if (date.lower_text != '上') {
                    //         date.upper_x -= this.options.column_width / 2;
                    //     }
                    // }
                }

                const $upper_text = createSVG('text', {
                    x: date.upper_x + textoffsetx,
                    y: date.upper_y,
                    innerHTML: date.upper_text,
                    class: 'upper-text',
                    append_to: this.layers.date
                });

                createSVG('line', {
                    x1: date.upper_x + date.upper_padding + offsetx,
                    y1: 0,
                    x2: date.upper_x + date.upper_padding + offsetx,
                    y2: 36,
                    class: 'header-row-line',
                    append_to: this.layers.date
                });

                // remove out-of-bound dates
                if (
                    $upper_text.getBBox().x2 > this.layers.grid.getBBox().width
                ) {
                    $upper_text.remove();
                }
            }
        }
        createSVG('line', {
            x1: 0,
            y1: 36,
            x2: (this.dates.length + 1) * this.options.column_width,
            y2: 36,
            class: 'header-row-line',
            append_to: this.layers.date
        });

        createSVG('line', {
            x1: 0,
            y1: 72,
            x2: (this.dates.length + 1) * this.options.column_width,
            y2: 72,
            class: 'row-line',
            append_to: this.layers.date
        });
    }

    get_dates_to_draw() {
        let last_date = null;
        const dates = this.dates.map((date, i) => {
            const d = this.get_date_info(date, last_date, i);
            last_date = date;
            return d;
        });
        return dates;
    }

    get_date_info(date, last_date, i) {
        if (!last_date) {
            switch (this.options.view_mode) {
                case 'Year':
                case 'Quarterly':
                case VIEW_MODE.Quarterly_Month:
                case 'Month': {
                    last_date = date_utils.add(date, 2, 'year');
                    break;
                }
                case 'Week': {
                    last_date = date_utils.add(date, 7, 'month');
                    break;
                }
                case 'Day': {
                    last_date = date_utils.add(date, 1, 'month');
                    break;
                }
                case 'Half Day': {
                    last_date = date_utils.add(date, 1, 'day');
                    break;
                }
                case 'Hour': {
                    last_date = date_utils.add(date, 1, 'day');
                    break;
                }
                default: {
                    last_date = date_utils.add(date, 1, 'year');
                }
            }
        }
        const date_text = {
            Hour_lower: date_utils.format(date, 'HH:00', this.options.language),
            'Quarter Day_lower': date_utils.format(
                date,
                'HH:00',
                this.options.language
            ),
            'Half Day_lower': date_utils.format(
                date,
                'TT',
                this.options.language
            ),
            Day_lower:
                date.getDate() !== last_date.getDate() ||
                date.getMonth() !== last_date.getMonth() ||
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'D', this.options.language)
                    : '',
            Week_lower: date_utils.format(date, 'w', this.options.language),
            Month_lower: date_utils.format(date, 'MMMM', this.options.language),
            'Quarterly Month_lower': date_utils.format(
                date,
                'MMMM',
                this.options.language
            ),
            Quarterly_lower: date_utils.format(
                date,
                'YYYYQ',
                this.options.language
            ),
            Year_lower: date_utils.format(
                date,
                'YYYYTT',
                this.options.language
            ),
            Hour_upper:
                date.getDate() !== last_date.getDate() ||
                date.getMonth() !== last_date.getMonth() ||
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(
                          date,
                          'YYYY年MMMD日',
                          this.options.language
                      )
                    : '',
            'Quarter Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D MMM', this.options.language)
                    : '',
            'Half Day_upper':
                date.getDate() !== last_date.getDate() ||
                date.getMonth() !== last_date.getMonth() ||
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'MMMD日', this.options.language)
                    : '',
            Day_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(
                          date,
                          'YYYY年MMMM',
                          this.options.language
                      )
                    : '',
            Week_upper:
                date_utils.format(date, 'YYYYW', this.options.language) !== date_utils.format(last_date, 'YYYYW', this.options.language)
                    ? date_utils.format(date, 'YYYY年MMMMD日', this.options.language)
                    : '',
            Month_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.options.language)
                    : '',
            'Quarterly Month_upper':
                date_utils.format(date, 'YYYY,YYYYQ', this.options.language) !== date_utils.format(last_date, 'YYYY,YYYYQ', this.options.language)
                    ? date_utils.format(date, 'YYYY,YYYYQ', this.options.language)
                    : ''
            ,
            Quarterly_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.options.language)
                    : '',
            Year_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.options.language)
                    : ''
        };

        const base_pos = {
            x: i * this.options.column_width,
            lower_y: 58,
            upper_y: 24
        };

        const x_pos = {
            Hour_lower: this.options.column_width / 2,
            Hour_upper: this.options.column_width * 24 / 2,
            'Quarter Day_lower': 0,
            'Quarter Day_upper': this.options.column_width * 4 / 2,
            'Half Day_lower': this.options.column_width / 2,
            'Half Day_upper': this.options.column_width * 2 / 2,
            Day_lower: this.options.column_width / 2,
            Day_upper: this.options.column_width * 30 / 2,
            Week_lower: this.options.column_width / 2,
            Week_upper: this.options.column_width * 7 / 2,
            Month_lower: this.options.column_width / 2,
            Month_upper: this.options.column_width * 12 / 2,
            Year_lower: this.options.column_width / 2,
            Year_upper: this.options.column_width,
            Quarterly_lower: this.options.column_width / 2,
            Quarterly_upper: this.options.column_width * 2,
            'Quarterly Month_lower': this.options.column_width / 2,
            'Quarterly Month_upper':
                this.options.column_width + this.options.column_width / 2
        };

        return {
            upper_text: date_text[`${this.options.view_mode}_upper`],
            lower_text: date_text[`${this.options.view_mode}_lower`],
            upper_x: base_pos.x + x_pos[`${this.options.view_mode}_upper`],
            upper_y: base_pos.upper_y,
            lower_x: base_pos.x + x_pos[`${this.options.view_mode}_lower`],
            lower_y: base_pos.lower_y,
            lower_padding:
                x_pos[`${this.options.view_mode}_lower`] ||
                this.options.padding,
            upper_padding: x_pos[`${this.options.view_mode}_upper`] || this.options.padding,
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        };
    }

    make_bars() {
        this.bars = this.tasks.map(task => {
            const bar = new Bar(this, task);
            this.layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    make_arrows() {
        this.arrows = [];
        for (let task of this.tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map(task_id => {
                    const dependency = this.get_task(task_id);
                    if (!dependency) return;
                    const arrow = new Arrow(
                        this,
                        this.bars[dependency._index], // from_task
                        this.bars[task._index] // to_task
                    );
                    this.layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter(Boolean); // filter falsy values
            this.arrows = this.arrows.concat(arrows);
        }
    }

    map_arrows_on_bars() {
        for (let bar of this.bars) {
            bar.arrows = this.arrows.filter(arrow => {
                return (
                    arrow.from_task.task.id === bar.task.id ||
                    arrow.to_task.task.id === bar.task.id
                );
            });
        }
    }

    set_width() {
        const cur_width = this.$svg.getBoundingClientRect().width;
        const actual_width = this.$svg
            .querySelector('.grid .grid-row')
            .getAttribute('width');
        if (cur_width < actual_width) {
            this.$svg.setAttribute('width', actual_width);
        }
        this.$svg_header.setAttribute(
            'width',
            parseInt(actual_width) + this.options.column_width
        );
        this.$svg_header.setAttribute('height', 73);
        this.$svg_data_header.setAttribute('height', 73);
    }

    set_scroll_position() {
        const parent_element = this.$svg.parentElement;
        if (!parent_element) return;
        var view_mode = 'hour';
        switch (this.options.view_mode) {
            case 'Year':

            case 'Week':
            case 'Quarterly': {
                view_mode = 'day';
                break;
            }
            case 'Day':
            case 'Half Day':
            case 'Hour':
            case 'Month':
            case VIEW_MODE.Quarterly_Month:
                view_mode = 'hour';
                break;
        }

        const hours_before_first_task = date_utils.diff(
            this.get_oldest_starting_date(),
            this.gantt_start,
            view_mode
        );

        let scroll_pos =
            hours_before_first_task /
                this.options.step *
                this.options.column_width -
            this.options.column_width;

        switch (this.options.view_mode) {
            case 'Year': {
                scroll_pos =
                    hours_before_first_task *
                        this.options.column_width /
                        365 *
                        2 -
                    this.options.column_width;
                break;
            }
            case 'Week': {
                scroll_pos =
                    hours_before_first_task * this.options.column_width -
                    this.options.column_width;
                break;
            }
            case 'Quarterly': {
                scroll_pos =
                    hours_before_first_task *
                        this.options.column_width /
                        365 *
                        4 -
                    this.options.column_width;
                break;
            }
        }

        parent_element.scrollLeft = scroll_pos;
    }

    bind_grid_click() {
        $.on(
            this.$svg,
            this.options.popup_trigger,
            '.grid-row, .grid-header',
            () => {
                this.unselect_all();
                this.hide_popup();
            }
        );
    }
    bind_container_events_mobile() {
        let that = this;
        let mousedrag = false;
        let mousedragx = 0;
        let scrollx = 0;
        let mousedragy = 0;
        let scrolly = 0;

        let mousedown = function(e) {
            let touch = e.changedTouches[0];
            mousedrag = true;
            mousedragx = touch.clientX || touch.pageX;
            mousedragy = touch.clientY || touch.pageY;
            scrollx = $('.task-content-wrapper').scrollLeft;
            scrolly = $('.task-content-wrapper').scrollTop;
            let mousemove = function(e) {
                if (mousedrag) {
                    let touchm = e.changedTouches[0];
                    if ((touchm.clientX || touchm.pageX) > 0) {
                        let ss = (touchm.clientX || touchm.pageX) - mousedragx;
                        let ssy = (touchm.clientY || touchm.pageY) - mousedragy;
                        let pos = scrollx + (0 - ss);
                        let posy = scrolly + (0 - ssy);
                        // console.log(pos,posy);
                        if (pos >= 0) {
                            $('.task-content-wrapper').scrollLeft = pos;
                        } else {
                            pos = 0;
                            $('.task-content-wrapper').scrollLeft = pos;
                        }
                        if (posy >= 0) {
                            $('.task-content-wrapper').scrollTop = posy;
                        } else {
                            posy = 0;
                            $('.task-content-wrapper').scrollTop = posy;
                        }
                    }
                }
                e.preventDefault();
                e.stopPropagation();
            };
            that.$container.addEventListener('touchmove', mousemove, false);
            let mouseup = function(e) {
                // console.log("mousemove")
                mousedrag = false;
                mousedragx = 0;
                that.$container.removeEventListener(
                    'mousemove',
                    mousemove,
                    false
                );
                document.removeEventListener('touchend', mouseup, false);
            };
            document.addEventListener('touchend', mouseup, false);
            e.preventDefault();
            e.stopPropagation();
        };
        that.$container.addEventListener('touchstart', mousedown, false);
        $.on(this.$task_content, 'scroll', e => {
            // this.unselect_all();
            // this.hide_popup();
            // console.log($(e.srcElement).scrollLeft);
            that.$svg_header.setAttribute(
                'style',
                'transform: translate(' +
                    (0 - $(e.srcElement).scrollLeft) +
                    'px,0)'
            );
            that.$svg_data_content.setAttribute(
                'style',
                'transform: translate(0,' +
                    (0 - $(e.srcElement).scrollTop) +
                    'px)'
            );
        });
    }

    bind_container_events() {
        let that = this;
        let mousedrag = false;
        let mousedragx = 0;
        let scrollx = 0;
        let mousedragy = 0;
        let scrolly = 0;

        let mousedown = function(e) {
            mousedrag = true;
            mousedragx = e.clientX;
            mousedragy = e.clientY;
            scrollx = $('.task-content-wrapper').scrollLeft;
            scrolly = $('.task-content-wrapper').scrollTop;
            let mousemove = function(e) {
                if (mousedrag) {
                    if (e.clientX > 0) {
                        // console.log(e.currentTarget);
                        let ss = e.clientX - mousedragx;
                        let ssy = e.clientY - mousedragy;
                        let pos = scrollx + (0 - ss);
                        let posy = scrolly + (0 - ssy);
                        if (pos >= 0) {
                            $('.task-content-wrapper').scrollLeft = pos;
                        } else {
                            pos = 0;
                            $('.task-content-wrapper').scrollLeft = pos;
                        }
                        if (posy >= 0) {
                            $('.task-content-wrapper').scrollTop = posy;
                        } else {
                            posy = 0;
                            $('.task-content-wrapper').scrollTop = posy;
                        }
                    }
                }
                // e.preventDefault();
                e.stopPropagation();
                return false;
            };
            that.$container.addEventListener('mousemove', mousemove, false);
            let mouseup = function(e) {
                // console.log("mousemove")
                mousedrag = false;
                mousedragx = 0;
                that.$container.removeEventListener(
                    'mousemove',
                    mousemove,
                    false
                );
                document.removeEventListener('mouseup', mouseup, false);
            };
            document.addEventListener('mouseup', mouseup, false);
            // e.preventDefault();
            e.stopPropagation();
            return false;
        };
        that.$container.addEventListener('mousedown', mousedown, false);
        $.on(this.$task_content, 'scroll', e => {
            // this.unselect_all();
            // this.hide_popup();
            // console.log($(e.srcElement).scrollLeft);
            that.$svg_header.setAttribute(
                'transform',
                'translate(' + (0 - $(e.srcElement).scrollLeft) + ',0)'
            );
            that.$svg_data_content.setAttribute(
                'transform',
                'translate(0,' + (0 - $(e.srcElement).scrollTop) + ')'
            );
        });
    }

    bind_bar_events() {
        let is_dragging = false;
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing_left = false;
        let is_resizing_right = false;
        let parent_bar_id = null;
        let bars = []; // instanceof Bar
        this.bar_being_dragged = null;

        function action_in_progress() {
            return is_dragging || is_resizing_left || is_resizing_right;
        }

        $.on(this.$svg, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
            const bar_wrapper = $.closest('.bar-wrapper', element);

            if (element.classList.contains('left')) {
                is_resizing_left = true;
            } else if (element.classList.contains('right')) {
                is_resizing_right = true;
            } else if (element.classList.contains('bar-wrapper')) {
                is_dragging = true;
            }

            bar_wrapper.classList.add('active');

            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            parent_bar_id = bar_wrapper.getAttribute('data-id');
            const ids = [
                parent_bar_id,
                ...this.get_all_dependent_tasks(parent_bar_id)
            ];
            bars = ids.map(id => this.get_bar(id));

            this.bar_being_dragged = parent_bar_id;

            bars.forEach(bar => {
                const $bar = bar.$bar;
                $bar.ox = $bar.getX();
                $bar.oy = $bar.getY();
                $bar.owidth = $bar.getWidth();
                $bar.finaldx = 0;
            });
            e.stopPropagation();
            e.preventDefault();
            return !1;
        });

        $.on(this.$svg, 'mousemove', e => {
            if (!action_in_progress()) return;
            const dx = e.offsetX - x_on_start;
            const dy = e.offsetY - y_on_start;

            bars.forEach(bar => {
                const $bar = bar.$bar;
                $bar.finaldx = this.get_snap_position(dx);

                if (is_resizing_left) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx,
                            width: $bar.owidth - $bar.finaldx
                        });
                    } else {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx
                        });
                    }
                } else if (is_resizing_right) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            width: $bar.owidth + $bar.finaldx
                        });
                    }
                } else if (is_dragging) {
                    bar.update_bar_position({ x: $bar.ox + $bar.finaldx });
                }
            });
            e.stopPropagation();
            e.preventDefault();
            return !1;
        });

        document.addEventListener('mouseup', e => {
            if (is_dragging || is_resizing_left || is_resizing_right) {
                bars.forEach(bar => bar.group.classList.remove('active'));
            }

            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
        });

        $.on(this.$svg, 'mouseup', e => {
            this.bar_being_dragged = null;
            bars.forEach(bar => {
                const $bar = bar.$bar;
                if (!$bar.finaldx) return;
                bar.date_changed();
                bar.set_action_completed();
            });
        });

        this.bind_bar_progress();
    }

    bind_bar_progress() {
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing = null;
        let bar = null;
        let $bar_progress = null;
        let $bar = null;

        $.on(this.$svg, 'mousedown', '.handle.progress', (e, handle) => {
            is_resizing = true;
            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            const $bar_wrapper = $.closest('.bar-wrapper', handle);
            const id = $bar_wrapper.getAttribute('data-id');
            bar = this.get_bar(id);

            $bar_progress = bar.$bar_progress;
            $bar = bar.$bar;

            $bar_progress.finaldx = 0;
            $bar_progress.owidth = $bar_progress.getWidth();
            $bar_progress.min_dx = -$bar_progress.getWidth();
            $bar_progress.max_dx = $bar.getWidth() - $bar_progress.getWidth();
            e.stopPropagation();
            e.preventDefault();
            return !1;
        });

        $.on(this.$svg, 'mousemove', e => {
            if (!is_resizing) return;
            let dx = e.offsetX - x_on_start;
            let dy = e.offsetY - y_on_start;

            if (dx > $bar_progress.max_dx) {
                dx = $bar_progress.max_dx;
            }
            if (dx < $bar_progress.min_dx) {
                dx = $bar_progress.min_dx;
            }

            const $handle = bar.$handle_progress;
            $.attr($bar_progress, 'width', $bar_progress.owidth + dx);
            $.attr($handle, 'points', bar.get_progress_polygon_points());
            $bar_progress.finaldx = dx;
            e.stopPropagation();
            e.preventDefault();
            return !1;
        });

        $.on(this.$svg, 'mouseup', () => {
            is_resizing = false;
            if (!($bar_progress && $bar_progress.finaldx)) return;
            bar.progress_changed();
            bar.set_action_completed();
            e.stopPropagation();
            e.preventDefault();
            return !1;
        });
    }

    get_all_dependent_tasks(task_id) {
        let out = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(this.dependency_map[curr]);
                return acc;
            }, []);

            out = out.concat(deps);
            to_process = deps.filter(d => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }

    get_snap_position(dx) {
        let odx = dx,
            rem,
            position;

        if (this.view_is(VIEW_MODE.WEEK)) {
            rem = dx % (this.options.column_width / 7);
            position =
                odx -
                rem +
                (rem < this.options.column_width / 14
                    ? 0
                    : this.options.column_width / 7);
        } else if (this.view_is(VIEW_MODE.MONTH)) {
            rem = dx % (this.options.column_width / 30);
            position =
                odx -
                rem +
                (rem < this.options.column_width / 60
                    ? 0
                    : this.options.column_width / 30);
        } else {
            rem = dx % this.options.column_width;
            position =
                odx -
                rem +
                (rem < this.options.column_width / 2
                    ? 0
                    : this.options.column_width);
        }
        return position;
    }

    unselect_all() {
        [...this.$svg.querySelectorAll('.bar-wrapper')].forEach(el => {
            el.classList.remove('active');
        });
    }

    view_is(modes) {
        if (typeof modes === 'string') {
            return this.options.view_mode === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some(mode => this.options.view_mode === mode);
        }

        return false;
    }

    get_task(id) {
        return this.tasks.find(task => {
            return task.id === id;
        });
    }

    get_bar(id) {
        return this.bars.find(bar => {
            return bar.task.id === id;
        });
    }
 
    show_popup(options) {
        if (!this.popup) {
            this.popup = new Popup(
                this.popup_wrapper,
                this.options.custom_popup_html
            );
        }
        this.popup.make();
        this.popup.show(options);
        var x = this.elX;
        var y = this.elY;
        if (options.pos) {
            x = options.pos.x;
            y = options.pos.y;
        }
        let $containerwidth = this.$container.getBoundingClientRect().right;
        let $containerheight = this.$container.getBoundingClientRect().bottom;

        if (this.popup.parent.clientWidth + x > $containerwidth) {
            x = $containerwidth - this.popup.parent.clientWidth - 20;
        }
        if (this.popup.parent.clientHeight + y > $containerheight) {
            y = $containerheight - this.popup.parent.clientHeight - 20;
        }

        this.popup.parent.style.left = x + 10 + 'px';
        this.popup.parent.style.top = y + 10 + 'px';
    }

    hide_popup() {
        this.popup && this.popup.hide();
    }

    trigger_event(event, args) {
        if (this.options['on_' + event]) {
            return this.options['on_' + event].apply(null, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Gantt
     */
    get_oldest_starting_date() {
        return this.tasks
            .map(task => task._start)
            .reduce(
                (prev_date, cur_date) =>
                    cur_date <= prev_date ? cur_date : prev_date
            );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Gantt
     */
    clear() {
        this.$svg.innerHTML = '';
        this.$svg_header.innerHTML = '';
    }
}

Gantt.VIEW_MODE = VIEW_MODE;

function generate_id(task) {
    return (
        task.name +
        '_' +
        Math.random()
            .toString(36)
            .slice(2, 12)
    );
}
