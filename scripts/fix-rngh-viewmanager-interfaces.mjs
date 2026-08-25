import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const FILES = [
  'node_modules/react-native-gesture-handler/android/paper/src/main/java/com/facebook/react/viewmanagers/RNGestureHandlerButtonManagerInterface.java',
  'node_modules/react-native-gesture-handler/android/paper/src/main/java/com/facebook/react/viewmanagers/RNGestureHandlerRootViewManagerInterface.java',
];

function transform(content) {
  let next = content;

  next = next.replace(
    /\nimport com\.facebook\.react\.uimanager\.ViewManagerWithGeneratedInterface;\n/g,
    '\n',
  );

  next = next.replace(
    /public interface (\w+)<T extends View> extends ViewManagerWithGeneratedInterface \{/g,
    'public interface $1<T extends View> {',
  );

  return next;
}

async function patchFile(filePath) {
  const absPath = resolve(process.cwd(), filePath);

  try {
    const original = await readFile(absPath, 'utf8');
    const updated = transform(original);

    if (updated !== original) {
      await writeFile(absPath, updated, 'utf8');
      console.log(`[postinstall] Patched ${filePath}`);
    }
  } catch (error) {
    console.log(
      `[postinstall] Skip ${filePath}: ${(error && error.message) || error}`,
    );
  }
}

await Promise.all(FILES.map(patchFile));
