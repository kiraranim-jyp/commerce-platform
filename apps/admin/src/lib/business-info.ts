/**
 * N-3.13 Part N(CPO 지시) — Footer에 표시할 실제 운영 사업자 정보. 통신판매업
 * 신고증 기준으로만 채운다 — 사업자등록번호/전화번호/대표자 생년월일 등
 * 확인되지 않은 정보는 추측해서 추가하지 않는다. 상세주소(동/호수)는
 * CPO 지시로 표시하지 않는다(신고증 소재지까지만).
 */
export const BUSINESS_INFO = {
  serviceName: "따져",
  serviceNameEn: "TTAEJYO",
  serviceDescription: "원가부터 마진까지, 꼼꼼하게 따져드립니다.",
  businessName: "규하맘샵",
  representative: "신주연",
  address: "경기도 하남시 미사강변한강로 326",
  mailOrderRegistrationNumber: "2021-경기하남-0084",
  email: "detourdada@gmail.com",
} as const;
