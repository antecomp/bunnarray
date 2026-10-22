/**
 * @fileoverview
 * Takes our Dialogue AST and "lowers" it into a linear set of instructions.
 */

import {DialogueAST, Statement} from '../language/ast';
import { INS, Instruction, Operation, Program } from "./instructions";

const UNRESOLVED = -1;

export default function (ast: DialogueAST): Program {
    const instructions: Instruction[] = [];
    const labels: Record<string, number> = Object.create(null); // <- removes prototype names.
    const unresolvedGotos: { fromIndex: number, target: string }[] = [];

    // Consider refactoring this to have it return the instruction and the index.
    const emit = (next: Instruction) => instructions.push(next) - 1;
    const pos = () => instructions.length;

    function defineLabel(name: string) {
        if (labels[name] !== undefined) throw new Error("duplicate label");
        labels[name] = pos();
    }

    function compileSequence(statements: Statement[]) {
        statements.forEach(compileStatement);
    }

    function compileStatement(statement: Statement) {
        switch (statement.type) {
            case 'say':
                emit(INS('SAY', { text: statement.text }));
                break;
            case 'label':
                defineLabel(statement.name);
                break;
            case 'goto': {
                const jumpIndex = emit(INS('JUMP', { target: UNRESOLVED }));
                unresolvedGotos.push({
                    fromIndex: jumpIndex,
                    target: statement.target
                })
                break;
            }
            case 'choice': {
                const choiceIndex = emit(INS('CHOICE', { choices: [] }));
                const currentChoice = instructions[choiceIndex] as Operation<'CHOICE'>
                const exitJumps: Operation<'JUMP'>[] = [];

                statement.branches.forEach(branch => {
                    currentChoice.choices.push({
                        text: branch.text,
                        target: pos()
                    });

                    compileSequence(branch.statements);

                    // Jump out, don't fall into next choice.
                    const exit = INS('JUMP', { target: UNRESOLVED });
                    exitJumps.push(exit);
                    emit(exit);
                });

                const end = pos();
                exitJumps.forEach(jump => jump.target = end);

                break;
            }
            case 'match': {
                const matchIndex = emit(INS('MATCH', {
                    on: statement.on,
                    cases: Object.create(null),
                    fallback: UNRESOLVED
                }));
                const currentMatch = instructions[matchIndex] as Operation<'MATCH'>;
                const exitJumps: Operation<'JUMP'>[] = [];

                statement.branches.forEach(branch => {
                    if (currentMatch.cases[branch.case]) throw new Error("duplicate cases in branch");
                    currentMatch.cases[branch.case] = pos();

                    compileSequence(branch.statements);

                    const exit = INS('JUMP', { target: UNRESOLVED });
                    exitJumps.push(exit);
                    emit(exit);
                });

                const end = pos();
                currentMatch.fallback = end;
                exitJumps.forEach(jump => jump.target = end);

                break;
            }

            case 'skip': {
                const skipLoc = emit(INS('JUMP', { target: UNRESOLVED }));
                defineLabel(statement.label);
                compileSequence(statement.statements);
                (instructions[skipLoc] as Operation<'JUMP'>).target = pos();
                break;
            }

            case 'set': {
                emit(INS('SET', {
                    identifier: statement.identifier,
                    value: statement.value
                }));
                break;
            }
        }
    }

    compileSequence(ast.statements);
    emit({ op: 'END' });

    unresolvedGotos.forEach(pending => {
        if(labels[pending.target] === undefined) throw new Error('encountered goto to unknown label ' + pending.target);

        (instructions[pending.fromIndex] as Operation<'JUMP'>).target = labels[pending.target];
    })


    return { instructions }
}