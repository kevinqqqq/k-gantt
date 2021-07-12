/*
 * @Author: your name
 * @Date: 2021-07-07 10:21:07
 * @LastEditTime: 2021-07-11 13:49:32
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \gantt-master\src\popup.js
 */
export default class Popup {
    constructor(parent, custom_html) {
        this.parent = parent;
        this.custom_html = custom_html;
        this.make();
    }

    make() {
        this.parent.innerHTML = `
            <div id = 'tooltip' style="fixed: ;display: block;white-space: nowrap;z-index: 2000;user-select: none;pointer-events: none;font-family: verdana;fill: rgb(255, 255, 255);color: rgb(255, 255, 255);font-size: 12px;background-color: rgba(0, 0, 0, 0.498);border-style: solid;border-width: 0px;border-color: rgb(0, 0, 0);border-radius: 2px;box-shadow: rgba(0, 0, 0, 0.2) 1px 1px 2px;padding: 5px;left: 351px;top: 181px;">
            <div>
                <div>{$str}</div>
                <div>{$starttime}</div>
                <div>{$endtime}</div>
                <div>{$progress}</div>
            </div>
            </div>
        `;

        this.hide();
    }

    show(options) {
        if (!options.target_element) {
            throw new Error('target_element is required to show popup');
        }
        if (!options.position) {
            options.position = 'left';
        }
        const target_element = options.target_element;

        if (this.custom_html) {
            let html = this.custom_html(options.task);
            html += '<div class="pointer"></div>';
            this.parent.innerHTML = html;
            this.pointer = this.parent.querySelector('.pointer');
        } else {
            this.parent.innerHTML = this.parent.innerHTML.replace(
                '{$starttime}',
                options.starttime
            );
            this.parent.innerHTML = this.parent.innerHTML.replace(
                '{$endtime}',
                options.endtime
            );
            this.parent.innerHTML = this.parent.innerHTML.replace(
                '{$progress}',
                options.progress
            );
            this.parent.innerHTML = this.parent.innerHTML.replace(
                '{$str}',
                options.str
            );
            // set data
            // this.title.innerHTML = options.title;
            // this.subtitle.innerHTML = options.subtitle;
            // this.parent.style.width = this.parent.clientWidth + 'px';
        }

        // set position
        let position_meta;
        if (target_element instanceof HTMLElement) {
            position_meta = target_element.getBoundingClientRect();
        } else if (target_element instanceof SVGElement) {
            position_meta = options.target_element.getBBox();
        }

        // if (options.position === 'left') {
        //     this.parent.style.left =
        //         position_meta.x + (position_meta.width + 10) + 'px';
        //     this.parent.style.top = position_meta.y + 'px';

        //     this.pointer.style.transform = 'rotateZ(90deg)';
        //     this.pointer.style.left = '-7px';
        //     this.pointer.style.top = '2px';
        // }

        // show
        this.parent.style.opacity = 1;
    }

    hide() {
        this.parent.style.opacity = 0;
    }
}
