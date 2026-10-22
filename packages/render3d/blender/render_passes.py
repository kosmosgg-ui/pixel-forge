# pixel-forge 프리렌더 패스(P7-alt). docs/prerender-poc/render_sprites.py를 기반으로 툴 파이프라인용으로 바꿨다.
# 실행: <bpy python> render_passes.py <job.json>
# 출력(job.out): <anim>_<dir>_<i>_id.png (R = 재질 번호, G = 오브젝트 번호), <anim>_<dir>_<i>_nrm.png (카메라 공간 법선 * 0.5 + 0.5),
#                <anim>_<dir>_<i>_alb.png (알베도 = base color 발광, Standard 변환이라 텍스처 sRGB 값 그대로 — 팔레트형 텍스처 색 영역 매핑용),
#                passes.json (재질·오브젝트 이름, fps, 프레임별 오브젝트 행렬 해시, 카메라 배율)
# 색 변환은 Raw: 번호·법선 값이 PNG에 그대로 들어가야 TS 쪽에서 정확히 되읽는다(POC의 Standard는 sRGB 곡선으로 법선을 휘게 했다).
import bpy, sys, os, json, math, hashlib
from mathutils import Vector, Euler

job = json.load(open(sys.argv[-1]))
out = job["out"]
W, H = job["size"]
S = job["supersample"]
os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(job["model"])[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=job["model"])
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=job["model"])
else:
    raise SystemExit("지원하지 않는 모델 형식: " + ext)
sc = bpy.context.scene

# 숨길 오브젝트: Spec hide(소품 고르기) + 모델에서 렌더 숨김으로 둔 보조 메시
for ob in list(sc.objects):
    if ob.name in job.get("hide", []) or (ob.type == "MESH" and ob.hide_render):
        bpy.data.objects.remove(ob, do_unlink=True)
missing = [n for n in job.get("hide", []) if n in bpy.data.objects]
if missing:
    raise SystemExit("숨기지 못한 오브젝트: " + ", ".join(missing))

# 모든 최상위 오브젝트를 원점의 빈 오브젝트 아래로 — 방향 회전을 한 축(Z)으로
pivot = bpy.data.objects.new("forge_pivot", None)
sc.collection.objects.link(pivot)
for ob in list(sc.objects):
    if ob is not pivot and ob.parent is None:
        ob.parent = pivot

arms = [o for o in sc.objects if o.type == "ARMATURE"]
meshes = sorted([o for o in sc.objects if o.type == "MESH"], key=lambda o: o.name)
for i, ob in enumerate(meshes):
    ob.pass_index = i + 1

mats = sorted({s.material.name for ob in meshes for s in ob.material_slots if s.material})
fallback = bpy.data.materials.new("__none__")
for ob in meshes:
    if not ob.material_slots:
        ob.data.materials.append(fallback)
names = mats + ["__none__"]

# 알베도 재질: 원래 재질의 base color(텍스처 포함)를 발광으로 — POC와 같다
alb_of, id_of = {}, {}
for name in names:
    m = bpy.data.materials[name]
    a = m.copy(); a.name = "forge_alb_" + name; a.use_nodes = True
    nt = a.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    o = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None) or nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    if bsdf and bsdf.inputs["Base Color"].is_linked:
        nt.links.new(bsdf.inputs["Base Color"].links[0].from_socket, em.inputs["Color"])
    elif bsdf:
        em.inputs["Color"].default_value = bsdf.inputs["Base Color"].default_value
    else:
        em.inputs["Color"].default_value = (0.5, 0.5, 0.5, 1)
    nt.links.new(em.outputs["Emission"], o.inputs["Surface"])
    alb_of[name] = a

# 재질 번호 패스: 재질마다 발광 (재질 번호/255, 오브젝트 번호/255, 0)
for mi, name in enumerate(names):
    m = bpy.data.materials.new("forge_id_" + name)
    id_of[name] = m
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    info = nt.nodes.new("ShaderNodeObjectInfo")
    div = nt.nodes.new("ShaderNodeMath"); div.operation = "DIVIDE"; div.inputs[1].default_value = 255.0
    comb = nt.nodes.new("ShaderNodeCombineColor"); comb.inputs[0].default_value = (mi + 1) / 255.0; comb.inputs[2].default_value = 0.0
    em = nt.nodes.new("ShaderNodeEmission"); o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(info.outputs["Object Index"], div.inputs[0])
    nt.links.new(div.outputs[0], comb.inputs[1])
    nt.links.new(comb.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], o.inputs["Surface"])

# 법선 패스(뷰 레이어 재질 덮어쓰기): 카메라 공간 법선
nm = bpy.data.materials.new("forge_normal"); nm.use_nodes = True; nt = nm.node_tree; nt.nodes.clear()
g = nt.nodes.new("ShaderNodeNewGeometry")
vt = nt.nodes.new("ShaderNodeVectorTransform"); vt.vector_type = "NORMAL"; vt.convert_from = "WORLD"; vt.convert_to = "CAMERA"
ma = nt.nodes.new("ShaderNodeVectorMath"); ma.operation = "MULTIPLY_ADD"
ma.inputs[1].default_value = (0.5, 0.5, 0.5); ma.inputs[2].default_value = (0.5, 0.5, 0.5)
em = nt.nodes.new("ShaderNodeEmission"); o = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(g.outputs["Normal"], vt.inputs[0]); nt.links.new(vt.outputs[0], ma.inputs[0])
nt.links.new(ma.outputs["Vector"], em.inputs["Color"]); nt.links.new(em.outputs["Emission"], o.inputs["Surface"])

# 렌더 설정: 1샘플·박스 필터 최소 폭(안티앨리어싱 없음)·투명 배경·Raw
sc.render.engine = "CYCLES"; sc.cycles.samples = 1; sc.cycles.use_denoising = False; sc.cycles.device = "CPU"
sc.cycles.use_adaptive_sampling = False
sc.cycles.pixel_filter_type = "BOX"; sc.cycles.filter_width = 0.01; sc.cycles.max_bounces = 0
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = W * S, H * S; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "Raw"; sc.view_settings.look = "None"
# 8비트 저장 때 디더 잡음(±1)이 번호 패스를 망가뜨린다 — 끈다
sc.render.dither_intensity = 0.0
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"; sc.render.image_settings.color_depth = "8"

cam_data = bpy.data.cameras.new("forge_cam"); cam_data.type = "ORTHO"; cam_data.clip_end = 1000
cam = bpy.data.objects.new("forge_cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
elev = math.radians(job["elevation"])
cam.rotation_euler = Euler((math.radians(90) - elev, 0, 0))
bpy.context.view_layer.update()
R = cam.matrix_world.to_3x3()
right, up, back = R.col[0], R.col[1], R.col[2]

ad_of = {}
for a in arms:
    ad = a.animation_data or a.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    ad_of[a.name] = ad

def use_action(name):
    act = bpy.data.actions.get(name)
    if act is None:
        raise SystemExit("모델에 없는 액션: " + name)
    for ad in ad_of.values():
        ad.action = act
        if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
            ad.action_slot = act.slots[0]

def pose(anim, yaw, f):
    use_action(job["actions"][anim])
    pivot.rotation_euler = (0, 0, math.radians(yaw))
    sc.frame_set(int(f))

def extent():
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    # 변형된 정점 기준(bound_box 모서리는 돌린 상자라 실제보다 넓게 잡힌다)
    for ob in meshes:
        e = ob.evaluated_get(dg)
        me = e.to_mesh()
        mw = e.matrix_world
        for v in me.vertices:
            p = mw @ v.co
            xs.append(p.dot(right)); ys.append(p.dot(up))
        e.to_mesh_clear()
    return min(xs), max(xs), min(ys), max(ys)

plan = [(anim, d, i, f) for anim, fs in job["frames"].items() for d in job["yaws"] for i, f in enumerate(fs)]
# 카메라 프레이밍: 전 애니·전 프레임·전 방향 범위(쓰러짐에서 잘리지 않게, 렌더할 프레임만이 아니라 frameAll × yawsAll),
# 배율은 첫 애니 첫 프레임의 키 기준 — 방향 고르기용 렌더와 본 렌더가 같은 카메라가 된다
yaws_all = job.get("yawsAll") or job["yaws"]
frame_all = job.get("frameAll") or job["frames"]
first_anim = next(iter(frame_all))
pose(first_anim, next(iter(yaws_all.values())), frame_all[first_anim][0])
r0 = extent()
box = [math.inf, -math.inf, math.inf, -math.inf]
for anim, fs in frame_all.items():
  for yaw in yaws_all.values():
    for f in fs:
      pose(anim, yaw, f)
      e = extent()
      box = [min(box[0], e[0]), max(box[1], e[1]), min(box[2], e[2]), max(box[3], e[3])]
margin, gap = job["margin"], job["bottomGap"]
ppu = min(job["height"] / (r0[3] - r0[2]), (W - 2 * margin) / (box[1] - box[0]), (H - margin - gap - 1) / (box[3] - box[2]))
cx = (box[0] + box[1]) / 2
cy = box[2] + (H / 2 - 1 - gap) / ppu
cam_data.ortho_scale = max(W, H) / ppu
cam.location = right * cx + up * cy + back * 100.0

def mhash(ob):
    m = ob.matrix_world
    return hashlib.sha1(",".join("%.4f" % v for row in m for v in row).encode()).hexdigest()[:12]

skinned = [any(md.type == "ARMATURE" for md in ob.modifiers) for ob in meshes]
slots = [(ob, i, s.material.name if s.material else "__none__") for ob in meshes for i, s in enumerate(ob.material_slots)]

def use_materials(table):
    for ob, i, name in slots:
        ob.material_slots[i].material = table[name]

def shot(path, override, transform):
    vl.material_override = override
    sc.view_settings.view_transform = transform
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
vl = sc.view_layers[0]
frames = []
for anim, d, i, f in plan:
    pose(anim, job["yaws"][d], f)
    base = os.path.join(out, f"{anim}_{d}_{i}")
    use_materials(id_of); shot(base + "_id.png", None, "Raw")
    shot(base + "_nrm.png", nm, "Raw")
    use_materials(alb_of); shot(base + "_alb.png", None, "Standard")
    frames.append({"anim": anim, "dir": d, "index": i, "frame": int(f), "objects": [mhash(ob) for ob in meshes]})

json.dump({
    "materials": names, "objects": [{"name": ob.name, "skinned": s} for ob, s in zip(meshes, skinned)],
    "fps": sc.render.fps / sc.render.fps_base, "pxPerUnit": ppu, "frames": frames,
}, open(os.path.join(out, "passes.json"), "w"), ensure_ascii=False, indent=1)
print("FORGE_PASSES_DONE", len(frames))
