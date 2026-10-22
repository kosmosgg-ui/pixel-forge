import bpy, sys, math, os, json
from mathutils import Vector, Euler
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
model, outdir, H = args[0], args[1], int(args[2])
plan=json.loads(args[3])   # {"Idle":[0],"Walking":[0,4,8,12,16,20],...}
dirs=json.loads(args[4])   # list of yaw degrees
os.makedirs(outdir,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=model)
sc=bpy.context.scene
arm=[o for o in sc.objects if o.type=='ARMATURE'][0]
root=arm
while root.parent: root=root.parent
# clear NLA so we can drive one action
ad=arm.animation_data or arm.animation_data_create()
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
# render setup
sc.render.engine='CYCLES'; sc.cycles.samples=1; sc.cycles.use_denoising=False
sc.cycles.device='CPU'; sc.cycles.pixel_filter_type='BOX'; sc.cycles.filter_width=0.01
sc.render.film_transparent=True; sc.render.resolution_x=sc.render.resolution_y=int(H*1.25)*2; sc.render.resolution_percentage=100
sc.view_settings.view_transform='Standard'; sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'
sc.cycles.max_bounces=0
# albedo materials: emission of base color
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt=m.node_tree; bsdf=next((n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'),None); out=next((n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'),None)
    if not bsdf or not out: continue
    em=nt.nodes.new('ShaderNodeEmission'); bc=bsdf.inputs['Base Color']
    if bc.is_linked: nt.links.new(bc.links[0].from_socket, em.inputs['Color'])
    else: em.inputs['Color'].default_value=bc.default_value
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
# normal override material
nm=bpy.data.materials.new('NORMAL'); nm.use_nodes=True; nt=nm.node_tree; nt.nodes.clear()
g=nt.nodes.new('ShaderNodeNewGeometry'); vm=nt.nodes.new('ShaderNodeVectorMath'); vm.operation='MULTIPLY_ADD'
vm.inputs[1].default_value=(0.5,0.5,0.5); vm.inputs[2].default_value=(0.5,0.5,0.5)
em=nt.nodes.new('ShaderNodeEmission'); o=nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(g.outputs['Normal'],vm.inputs[0]); nt.links.new(vm.outputs['Vector'],em.inputs['Color']); nt.links.new(em.outputs['Emission'],o.inputs['Surface'])
# camera: iso-ish 3/4 (elevation 35, azimuth fixed), ortho
cam_data=bpy.data.cameras.new('cam'); cam_data.type='ORTHO'; cam=bpy.data.objects.new('cam',cam_data); sc.collection.objects.link(cam); sc.camera=cam
# model height from rest bbox
sc.frame_set(0)
pts=[]
for ob in sc.objects:
    if ob.type=='MESH':
        pts+= [ob.matrix_world @ Vector(c) for c in ob.bound_box]
zmin=min(p.z for p in pts); zmax=max(p.z for p in pts); hgt=zmax-zmin
center=Vector((0,0,zmin+hgt*0.45))
elev=math.radians(30); az=math.radians(0)
dist=50
cam.location=center+Vector((0,-math.cos(elev),math.sin(elev)))*dist
cam.rotation_euler=Euler((math.radians(90)-elev,0,0))
cam_data.ortho_scale=hgt*1.6*(H*1.6)/(H*1.6)*1.0*(1.6/1.0)/1.6*1.6
cam_data.ortho_scale=hgt*1.25
cam_data.clip_end=200
json.dump({"cam_rot":list(cam.rotation_euler)},open(os.path.join(outdir,'cam.json'),'w'))
vl=sc.view_layers[0]
for act_name,frames in plan.items():
    act=bpy.data.actions.get(act_name)
    ad.action=act
    if hasattr(ad,'action_slot') and act and len(act.slots): ad.action_slot=act.slots[0]
    for yaw in dirs:
        root.rotation_mode='XYZ'; root.rotation_euler=(root.rotation_euler[0],root.rotation_euler[1],math.radians(yaw))
        for f in frames:
            sc.frame_set(int(f))
            base=os.path.join(outdir,f'{act_name}_{yaw}_{f}')
            vl.material_override=None; sc.render.filepath=base+'_alb.png'; bpy.ops.render.render(write_still=True)
            vl.material_override=nm; sc.render.filepath=base+'_nrm.png'; bpy.ops.render.render(write_still=True)
print('DONE')
