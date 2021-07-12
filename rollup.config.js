import sass from 'rollup-plugin-sass';
import uglify from 'rollup-plugin-uglify';
import merge from 'deepmerge';

const dev = {
    input: 'src/index.js',
    output: {
        name: 'Gantt',
        file: 'dist/k-gantt.js',
        format: 'iife'
    },
    plugins: [
        sass({
            output: 'dist/k-gantt.css'
        })
    ]
};
const prod = merge(dev, {
    output: {
        file: 'dist/k-gantt.min.js'
    },
    plugins: [uglify()]
});

export default [dev, prod];
