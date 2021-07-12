/*
 * @Author: your name
 * @Date: 2021-07-07 20:30:59
 * @LastEditTime: 2021-07-10 22:18:35
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \gantt-master\src\task_info.js
 */
import { $, createSVG } from './svg_utils';

export default class Dimension {
    constructor(gantt, task, columns, elheader, elcontent) {
        if (!columns || columns.length == 0) return;
        this.set_defaults(gantt, task, columns, elheader, elcontent);
        this.rows = [];
        this.valueMerges = [];
        this.make_datas();
    }
    /**
     * 初始化默认值
     * @param {*} gantt 整个gantt的属性
     * @param {*} task  任务信息
     * @param {*} columns 左侧的维度字段
     * @param {*} elheader 维度字段表头
     * @param {*} elcontent 维度字段实际内容
     */
    set_defaults(gantt, task, columns, elheader, elcontent) {
        this.text_offset_top = 11; //文字的偏移
        this.gantt = gantt;
        this.task = task;
        this.columns = columns;
        this.$elheader = elheader;
        this.$elcontent = elcontent;
    }

    /**
     * 一列数据输出完后，调整对应的位置
     * @param {*} col 所在字段
     * @param {*} col_x 所在字段的当前占宽的位置
     * @param {*} lines_layer 字段数据所在父级节点
     */
    render_col(col, col_x, parent) {
        let column = this.columns[col];
        let mergelen = this.valueMerges[col].length;
        for (let row = 0; row < mergelen; row++) {
            let value = this.valueMerges[col][row];
            if (value.el) {
                value.lineEl.setAttribute('x2', col_x);
                //判断是否有合并单元格
                if (
                    this.valueMerges[col][row + 1] &&
                    this.valueMerges[col][row + 1].isMerge == true
                ) {
                    var mergeCount = 1;
                    while (
                        this.valueMerges[col][row + mergeCount] &&
                        this.valueMerges[col][row + mergeCount].isMerge == true
                    ) {
                        mergeCount++;
                    }
                    let textpos =
                        parseFloat(value.el.getAttribute('y')) -
                        this.text_offset_top; // 得到基础高
                    textpos += mergeCount * this.row_height / 2 - 16 / 2;
                    // 合并单元格的位置， 行的基本高 + 合并单元格的总高度/2 - 字体高度/2
                    value.el.setAttribute('y', textpos);
                    row += mergeCount - 1;
                }
            }
        }
        // for (let el of parent.querySelectorAll('.col-' + col)) {
        //     //
        //     el.setAttribute('x2', col_x);
        // }
        col++;
        createSVG('line', {
            x1: col_x,
            y1: 0,
            x2: col_x,
            y2: this.grid_height,
            class: 'header-row-line',
            append_to: parent
        });
        createSVG('line', {
            x1: col_x,
            y1: 0,
            x2: col_x,
            y2: 72,
            class: 'header-row-line',
            append_to: this.$elheader
        });
    }

    make_datas() {
        // 画数据
        const layer = createSVG('g', {
            class: 'content',
            append_to: this.$elcontent
        });

        // 画线
        const lines_layer = createSVG('g', { append_to: this.$elcontent });
        this.grid_height =
            (this.gantt.options.bar_height + this.gantt.options.padding) *
                this.task.length +
            20;

        this.row_height =
            this.gantt.options.bar_height + this.gantt.options.padding;
        this.$elcontent.setAttribute('height', this.grid_height);
        this.$elcontent.setAttribute('width', 240);
        const row_width = this.columns.length * 120; //模拟占宽，绘制完成后会重新调整

        let col_x = 0;
        var col = 0;
        for (let column of this.columns) {
            let row_y = 0;
            let maxwidth = 40;
            let lasttext = null;
            this.valueMerges.push([]);
            let rect = createSVG('rect', {
                x: col_x,
                y: row_y,
                width: row_width,
                height: this.grid_height,
                class: 'data-col',
                append_to: layer
            });
            var row = 0;
            for (let task of this.task) {
                var text = '';
                if (task[column.field]) {
                    text = task[column.field];
                }
                let Merge = col == 0 ? null : this.valueMerges[col - 1][row];
                let cell = this.make_cell(
                    layer,
                    text,
                    lasttext,
                    col_x,
                    row_y,
                    Merge ? Merge.isMerge : null
                );
                if (cell) {
                    let box = cell.getBBox();

                    this.valueMerges[col].push({
                        el: cell,
                        // 画底部的线条
                        lineEl: createSVG('line', {
                            x1: col_x,
                            y1: row_y,
                            x2: col_x + maxwidth,
                            y2: row_y,
                            class: 'header-row-line',
                            append_to: lines_layer
                        }),
                        isMerge: false
                    });
                    maxwidth = box.width > maxwidth ? box.width : maxwidth; //判断当前数据列最大宽度
                } else {
                    this.valueMerges[col].push({
                        el: null,
                        isMerge: true
                    });
                }
                row++;
                lasttext = text;
                row_y += this.row_height;
            }
            //写表头
            this.make_cell(this.$elheader, column.label, null, col_x, 18);
            col_x += maxwidth + 10;
            this.render_col(col, col_x, lines_layer);
            rect.setAttribute('width', col_x);
            col++;
        }

        // 最后封线
        createSVG('line', {
            x1: 0,
            y1: this.grid_height - 20,
            x2: col_x,
            y2: this.grid_height - 20,
            class: 'header-row-line',
            append_to: lines_layer
        });

        this.content_width = col_x;
    }
    make_cell(layer, text, lasttext, col_x, row_y, merge) {

        var textbasex = 12;

        if (text !== lasttext) {
            return createSVG('text', {
                x: col_x + 5,
                y: row_y + this.text_offset_top + textbasex,
                innerHTML: text,
                class: 'content-text',
                append_to: layer
            })
        }
        if (merge === false) {
            return createSVG('text', {
                x: col_x + 5,
                y: row_y + this.text_offset_top + textbasex,
                innerHTML: text,
                class: 'content-text',
                append_to: layer
            })
        }
    }
}
