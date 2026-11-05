"""Keep only the three.js addon modules the app actually imports (recursively)."""
import re, pathlib, shutil
root = pathlib.Path(__file__).parent / 'app/vendor/three/examples/jsm'
entries = ['misc/GPUComputationRenderer.js', 'controls/OrbitControls.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js',
           'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js', 'postprocessing/ShaderPass.js', 'loaders/GLTFLoader.js', 'math/MeshSurfaceSampler.js']
keep, todo = set(), list(entries)
while todo:
    rel = todo.pop()
    if rel in keep: continue
    keep.add(rel)
    src = (root / rel).read_text()
    for m in re.finditer(r"""(?:import|export)[^'"]*?from\s*['"](\.{1,2}/[^'"]+)['"]""", src):
        dep = (pathlib.PurePosixPath(rel).parent / m.group(1))
        parts = []
        for p in dep.parts:
            if p == '..': parts.pop()
            elif p != '.': parts.append(p)
        todo.append('/'.join(parts))
out = root.parent / 'jsm_keep'
for rel in keep:
    dst = out / rel; dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(root / rel, dst)
shutil.rmtree(root); out.rename(root)
print(len(keep), 'modules kept:', sorted(keep))
