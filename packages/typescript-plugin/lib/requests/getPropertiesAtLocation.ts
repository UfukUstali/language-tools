import { FileRegistry, isCompletionEnabled } from '@vue/language-core';
import type * as ts from 'typescript';

export function getPropertiesAtLocation(
	this: {
		typescript: typeof import('typescript');
		languageService: ts.LanguageService;
		files: FileRegistry;
		isTsPlugin: boolean,
		getFileId: (fileName: string) => string,
	},
	fileName: string,
	position: number,
) {
	const { languageService, files, typescript: ts, isTsPlugin, getFileId } = this;

	// mapping
	const file = files.get(getFileId(fileName));
	if (file?.generated) {
		const virtualScript = file.generated.languagePlugin.typescript?.getScript(file.generated.code);
		if (!virtualScript) {
			return;
		}
		let mapped = false;
		for (const [_1, [_2, map]] of files.getMaps(virtualScript.code)) {
			for (const [position2, mapping] of map.getGeneratedOffsets(position)) {
				if (isCompletionEnabled(mapping.data)) {
					position = position2;
					mapped = true;
					break;
				}
			}
			if (mapped) {
				break;
			}
		}
		if (!mapped) {
			return;
		}
		if (isTsPlugin) {
			position += file.snapshot.getLength();
		}
	}


	const program: ts.Program = (languageService as any).getCurrentProgram();
	if (!program) {
		return;
	}

	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile) {
		return;
	}

	const node = findPositionIdentifier(sourceFile, sourceFile, position);
	if (!node) {
		return;
	}

	const checker = program.getTypeChecker();
	const type = checker.getTypeAtLocation(node);
	const props = type.getProperties();

	return props.map(prop => prop.name);

	function findPositionIdentifier(sourceFile: ts.SourceFile, node: ts.Node, offset: number) {

		let result: ts.Node | undefined;

		node.forEachChild(child => {
			if (!result) {
				if (child.end === offset && ts.isIdentifier(child)) {
					result = child;
				}
				else if (child.end >= offset && child.getStart(sourceFile) < offset) {
					result = findPositionIdentifier(sourceFile, child, offset);
				}
			}
		});

		return result;
	}
}
