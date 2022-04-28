import * as vscode from 'vscode'


export function activate(extensionContext: vscode.ExtensionContext) {

    console.log('"complete-statement" is activated.')

    const disposable: vscode.Disposable =
            vscode.commands.registerTextEditorCommand(
                    'extension.complete-statement',
                    (textEditor, textEditorEdit) =>
                        { complete_statement(textEditor, textEditorEdit) }
            )
    extensionContext.subscriptions.push(disposable)
}
export function deactivate() {
    console.log('"complete-statement" is deactivated.')
}


// todo: format current line,
// * adding spaces to () "" : +-/*%{}[]<>
// * remove trailing spaces and redundant spaces in the line, except those in string.
// todo: add setting to configure languages that don't use semicolons to break a line.
// todo: add more languages' syntax support, for example python-like : instead of {}

function complete_statement(textEditor: vscode.TextEditor,
                            textEditorEdit: vscode.TextEditorEdit
                           ): void
{
    let current_line_number: number = textEditor.selection.start.line
    let current_line: vscode.TextLine = textEditor.document.lineAt(current_line_number)
    
    // Get indentation level here for use with either
    // new lines after semicolon or new block of code.
    // Assuming use spaces to indent.
    const tab_stop: number = vscode.workspace.getConfiguration('editor').get('tabSize', 4)
    let indent_level: number = 0
    if (current_line.text.startsWith(' ')) // indented
    {
        const indent_position: number =
                current_line.text.lastIndexOf(" ".repeat(tab_stop))
        indent_level = indent_position / tab_stop + 1
    }
    const indent_space_count: number = tab_stop * (indent_level + 1)
    const indent_spaces: string = " ".repeat(indent_space_count)
    const less_indent_spaces: string = " ".repeat(tab_stop * indent_level)
    
    
    if (looks_like_complex_structure(current_line)) {
        
        vscode.commands.executeCommand('cursorMove', {'to': 'wrappedLineEnd'})
        let braces: string
        const allman: boolean =
            vscode.workspace.getConfiguration('complete-statement').get('useAllmanStyle', false)
        if (allman)
        {
            braces = `\n${less_indent_spaces}{\n${indent_spaces}` +
                    `\n${less_indent_spaces}}`
        }
        else
        {
            braces = `{\n${indent_spaces}\n${less_indent_spaces}}`
            if (!current_line.text.endsWith(" ")) // avoid duplicated spaces
            {
                braces = ` ${braces}`
            }
        }
        
        // After completion, vscode will move the cursor to the end of the added text
        // if the cursor is currently at the end of the line, otherwise the cursor
        // stays on the current line.
        // Figure out is_at_end here. 
        // Move the cursor into the newly created block.
        
        /* comment at april 2022:
        No need to check is_at_end!
        We can just move the cursor to the end of line before insertion. */
        
        
        /* -------------------------------------------------------------------------- */
        /* trying to get the async operations in right order. 
        Error: Edit is only valid while callback runs.
        
        according to https://github.com/microsoft/vscode/issues/78066,  
        original textEditorEdit.insert is not working here, so use textEditor and editBuilder instead. */
        
        vscode.commands.executeCommand('cursorMove', { to: 'wrappedLineEnd' })
            .then(() => { 
                textEditor.edit((editBuilder) => {
                    editBuilder.insert(current_line.range.end, braces);
                });
            }, error => {
            console.error(error)
            })
            .then(() => {
                vscode.commands.executeCommand('cursorMove', { to: 'up' });
                vscode.commands.executeCommand('cursorMove', { to: 'wrappedLineEnd' });
            }, error => {
                console.error(error)
            })
        
    } else {

        vscode.commands.executeCommand('cursorMove', { 'to': 'wrappedLineEnd' })
        
        if (!(current_line.text.endsWith('{') ||
            current_line.text.endsWith('}') ||
            current_line.text.endsWith(';') || 
            current_line.text.trim() === '')) { 
            textEditorEdit.insert(current_line.range.end, ';')
        } 

        textEditorEdit.insert(current_line.range.end, '\n' + less_indent_spaces)

    }
}


function looks_like_complex_structure(line: vscode.TextLine): boolean
{
    const trimmed: string = line.text.trim()
    // class and object
    if (trimmed.startsWith('class ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('object '))
    {
        return true
    }
    // if else
    // todo: more scenarios like elif and }else
    else if (trimmed.startsWith('if (') ||
             trimmed.startsWith('if(') ||
             trimmed.startsWith('} else') ||
             trimmed.startsWith('else'))
    {
        return true
    }
    // switch
    else if (trimmed.startsWith('switch (') ||
             trimmed.startsWith('switch('))
    {
        return true
    }
    // loop
    else if (trimmed.startsWith('for (') ||
             trimmed.startsWith('for(') ||
             trimmed.startsWith('while (') ||
             trimmed.startsWith('while(') ||
             trimmed.startsWith('do') ||
             trimmed.startsWith('loop'))
    {
        return true
    }
    // function
    else if (
             trimmed.startsWith('function ') || // javascript
             trimmed.startsWith('func ') || // swift
             trimmed.startsWith('fun ') || // kotlin
             trimmed.startsWith('def ') || // scala, python
             trimmed.startsWith('fn ') || // rust
             // Regexp is expensive, so we test it after other structures.
             /^\w+\s\w+\s?\(/.test(trimmed)) // c, java, ceylon
    {
        return true
    }
    return false
}
