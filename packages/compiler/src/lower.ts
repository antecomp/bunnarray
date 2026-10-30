/**
 * @fileoverview
 * Takes our Dialogue AST and "lowers" it into a linear set of instructions.
 */

import { DialogueAST, Statement } from './language/ast';
import type { Instruction, Opcode, Operation, Program } from '@bunnarray/vm';

/** Construct an Instruction while lowering the AST. */
function INS<O extends Opcode>(
    opcode: O,
    config: Omit<Extract<Instruction, { op: O }>, 'op'>
): Operation<O> {
    return { op: opcode, ...config } as Operation<O>;
}

const UNRESOLVED = -1;

export function lower(ast: DialogueAST): Program {
    const instructions: Instruction[] = [];
    const labels: Record<string, number> = Object.create(null); // <- removes prototype names.
    const unresolvedGotos: { jump: Operation<'JUMP'>, target: string }[] = [];

    const emit = (next: Instruction) => { instructions.push(next); };
    const pos = () => instructions.length;

    function defineLabel(name: string) {
        if (labels[name] !== undefined) throw new Error('duplicate label');
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
                const jump = INS('JUMP', { target: UNRESOLVED });
                emit(jump);
                unresolvedGotos.push({
                    jump,
                    target: statement.target
                });
                break;
            }

            case 'choice': {
                const currentChoice = INS('CHOICE', { choices: [], fallback: UNRESOLVED });
                emit(currentChoice);
                const exitJumps: Operation<'JUMP'>[] = [];

                statement.branches.forEach(branch => {
                    currentChoice.choices.push({
                        text: branch.text,
                        target: pos(),
                        ...(branch.id === undefined ? {} : { id: branch.id }),
                        ...(branch.condition === undefined ? {} : {
                            condition: {
                                identifier: branch.condition.identifier,
                                value: branch.condition.value
                            }
                        })
                    });

                    compileSequence(branch.statements);

                    // Jump out, don't fall into next choice.
                    const exit = INS('JUMP', { target: UNRESOLVED });
                    exitJumps.push(exit);
                    emit(exit);
                });

                const end = pos();
                currentChoice.fallback = end;
                exitJumps.forEach(jump => jump.target = end);

                break;
            }

            case 'branch': {
                const currentBranch = INS('BRANCH', { cases: [], fallback: UNRESOLVED });
                emit(currentBranch);
                const exitJumps: Operation<'JUMP'>[] = [];

                statement.cases.forEach(branchCase => {
                    currentBranch.cases.push({
                        condition: {
                            identifier: branchCase.condition.identifier,
                            value: branchCase.condition.value
                        },
                        target: pos()
                    });

                    compileSequence(branchCase.statements);

                    const exit = INS('JUMP', { target: UNRESOLVED });
                    exitJumps.push(exit);
                    emit(exit);
                });

                const end = pos();
                currentBranch.fallback = end;
                exitJumps.forEach(jump => jump.target = end);
                break;
            }

            case 'skip': {
                const skipJump = INS('JUMP', { target: UNRESOLVED });
                emit(skipJump);
                defineLabel(statement.label);
                compileSequence(statement.statements);
                skipJump.target = pos();
                break;
            }

            case 'set': {
                emit(INS('SET', {
                    identifier: statement.identifier,
                    value: statement.value
                }));
                break;
            }

            case 'signal': {
                emit(INS('SIGNAL', {
                    identifier: statement.identifier,
                    ...(statement.value === undefined ? {} : { value: statement.value })
                }));
                break;
            }

            case 'yield': {
                emit(INS('YIELD', {
                    identifier: statement.identifier,
                    ...(statement.value === undefined ? {} : { value: statement.value })
                }));
                break;                
            }

            case 'speaker': {
                emit(INS('SPEAKER', {
                    value: statement.value
                }));
                break;
            }

            case 'alternate': {
                emit(INS('ALTERNATE', {
                    speakers: statement.speakers
                }));
                break;
            }

            default:
                const exhaustive: never = statement;
                throw new Error(`Unhandled syntax node: ${exhaustive}`);
        }
    }

    compileSequence(ast.statements);
    emit({ op: 'END' });

    unresolvedGotos.forEach(pending => {
        if(labels[pending.target] === undefined) throw new Error('encountered goto to unknown label ' + pending.target);

        pending.jump.target = labels[pending.target];
    });

    return { 
        version: {
            major: 1,
            minor: 0,
            patch: 'indev'
        },
        instructions
    };
}
