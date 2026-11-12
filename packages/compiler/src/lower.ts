import { DialogueAST, Statement, type Condition, type SourcePosition } from './language/ast';
import type { BnyCondition, BnyInstruction, BnyOpcode, BnyOperation, BnyProgram } from '@bunnarray/vm';
import { CompilerSyntaxError } from './syntaxDiagnostics';

function lowerCondition(condition: Condition): BnyCondition {
    const negated = condition.negated ? { negated: true as const } : {};
    return condition.type === 'exists'
        ? { identifier: condition.identifier, ...negated }
        : { identifier: condition.identifier, value: condition.value, ...negated };
}

/** Construct a BnyInstruction while lowering the AST. */
function INS<O extends BnyOpcode>(
    opcode: O,
    config: Omit<Extract<BnyInstruction, { op: O }>, 'op'>
): BnyOperation<O> {
    return { op: opcode, ...config } as BnyOperation<O>;
}

const UNRESOLVED = -1;

export function lower(ast: DialogueAST): BnyProgram {
    const instructions: BnyInstruction[] = [];
    const labels: Record<string, number> = Object.create(null); // <- removes prototype names.
    const unresolvedGotos: { jump: BnyOperation<'JUMP'>, target: string, position: SourcePosition }[] = [];

    const emit = (next: BnyInstruction) => { instructions.push(next); };
    const pos = () => instructions.length;

    function semanticError(message: string, position: SourcePosition): never {
        throw new CompilerSyntaxError([{ kind: 'semantic', message, ...position }]);
    }

    function defineLabel(name: string, position: SourcePosition) {
        if (labels[name] !== undefined) semanticError(`duplicate label: ${name}`, position);
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
                defineLabel(statement.name, statement.position);
                break;

            case 'goto': {
                const jump = INS('JUMP', { target: UNRESOLVED });
                emit(jump);
                unresolvedGotos.push({
                    jump,
                    target: statement.target,
                    position: statement.position
                });
                break;
            }

            case 'choice': {
                const currentChoice = INS('CHOICE', { choices: [], fallback: UNRESOLVED });
                emit(currentChoice);
                const exitJumps: BnyOperation<'JUMP'>[] = [];

                statement.branches.forEach(branch => {
                    currentChoice.choices.push({
                        text: branch.text,
                        target: pos(),
                        ...(branch.id === undefined ? {} : { id: branch.id }),
                        ...(branch.condition === undefined ? {} : {
                            condition: lowerCondition(branch.condition)
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
                const exitJumps: BnyOperation<'JUMP'>[] = [];

                statement.cases.forEach(branchCase => {
                    currentBranch.cases.push({
                        condition: lowerCondition(branchCase.condition),
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
                defineLabel(statement.label, statement.position);
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
        if(labels[pending.target] === undefined) {
            semanticError(`encountered goto to unknown label: ${pending.target}`, pending.position);
        }

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
