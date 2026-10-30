// Measure a non-editable mirror so gutter numbers follow wrapped dialogue without
// adding line numbers or layout elements to CodeJar's source and undo history.
export function trackEditorLines(editor: HTMLElement): () => void {
    const numbers = document.getElementById('line-numbers')!;
    const mirror = document.getElementById('line-mirror')!;
    let frame = 0;
    let activeLine = 0;
    let previousSource: string | undefined;
    let previousWidth = 0;
    let heights: number[] = [];
    let labels: HTMLElement[] = [];

    function render(): void {
        frame = 0;
        const source = editor.textContent ?? '';
        const selection = window.getSelection();
        if (selection?.focusNode && editor.contains(selection.focusNode)) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.setEnd(selection.focusNode, selection.focusOffset);
            activeLine = range.toString().split('\n').length - 1;
        }

        // Cursor movement and scrolling can reuse the existing line measurements.
        if (source !== previousSource || editor.clientWidth !== previousWidth) {
            previousSource = source;
            previousWidth = editor.clientWidth;
            mirror.style.width = `${previousWidth}px`;
            const lines = source.split('\n').map(text => {
                const line = document.createElement('div');
                line.textContent = text || '\u200b';
                return line;
            });
            mirror.replaceChildren(...lines);
            heights = lines.map(line => line.getBoundingClientRect().height);
            labels = heights.map((height, index) => {
                const label = document.createElement('div');
                label.className = 'editor-line-number';
                label.textContent = String(index + 1);
                label.style.height = `${height}px`;
                return label;
            });
            numbers.replaceChildren(...labels);
        }
        activeLine = Math.min(activeLine, heights.length - 1);
        let top = parseFloat(getComputedStyle(editor).paddingTop);
        heights.forEach((height, index) => {
            labels[index].classList.toggle('is-active', index === activeLine);
            if (index === activeLine) {
                editor.style.setProperty('--active-line-top', `${top - editor.scrollTop}px`);
                editor.style.setProperty('--active-line-height', `${height}px`);
            }
            top += height;
        });
        numbers.style.transform = `translateY(${-editor.scrollTop}px)`;
    }

    function schedule(): void {
        if (!frame) frame = requestAnimationFrame(render);
    }

    const contentObserver = new MutationObserver(schedule);
    contentObserver.observe(editor, { childList: true, characterData: true, subtree: true });
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(editor);
    document.addEventListener('selectionchange', schedule);
    editor.addEventListener('scroll', schedule);
    render();

    return () => {
        cancelAnimationFrame(frame);
        contentObserver.disconnect();
        resizeObserver.disconnect();
        document.removeEventListener('selectionchange', schedule);
        editor.removeEventListener('scroll', schedule);
    };
}
