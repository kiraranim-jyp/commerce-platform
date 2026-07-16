// onnxruntime-node는 package.json이 dist/index.d.ts를 가리키지만 실제로는
// 그 파일을 배포하지 않는다(@imgly/background-removal-node가 끌어오는
// ~1.17.0 버전에서 확인됨). imgly.provider.ts에서 InferenceSession.create()를
// 패치하기 위해 런타임 값만 필요하므로 타입은 unknown으로 둔다.
declare module "onnxruntime-node";
