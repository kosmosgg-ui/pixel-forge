import bpy,sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
for a in bpy.data.actions: print('ACTION',a.name,a.frame_range[:])
for o in bpy.data.objects: print('OBJ',o.type,o.name,tuple(round(v,2) for v in o.dimensions))
for m in bpy.data.materials: print('MAT',m.name)
