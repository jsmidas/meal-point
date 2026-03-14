export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-dark text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">개인정보 처리방침</h1>
        <p className="text-text-muted text-sm mb-10">시행일: 2025년 3월 14일</p>

        <div className="space-y-8 text-text-secondary leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">1. 개인정보의 수집 및 이용 목적</h2>
            <p>밀포인트(이하 &quot;회사&quot;)는 다음의 목적을 위하여 개인정보를 처리합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>회원 가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 서비스 제공</li>
              <li>상품 및 서비스 제공: 급식용기, 식단프로그램, 식권발행기 등 상품 판매 및 배송</li>
              <li>마케팅 및 광고: 신규 서비스 안내, 이벤트 정보 제공</li>
              <li>고객 상담 및 불만 처리</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">2. 수집하는 개인정보 항목</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>필수항목:</strong> 이름(닉네임), 아이디, 비밀번호</li>
              <li><strong>선택항목:</strong> 이메일, 연락처, 업체명</li>
              <li><strong>소셜 로그인 시:</strong> 소셜 서비스 고유 식별자, 이름, 이메일 (해당 플랫폼 제공 범위 내)</li>
              <li><strong>자동 수집:</strong> 접속 IP, 쿠키, 서비스 이용 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <p>회원 탈퇴 시까지 보유하며, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약 또는 청약철회 기록 5년, 대금결제 및 재화 등의 공급 기록 5년</li>
              <li>통신비밀보호법: 접속 기록 3개월</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">4. 개인정보의 제3자 제공</h2>
            <p>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">5. 개인정보의 파기 절차 및 방법</h2>
            <p>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>전자적 파일: 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
              <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">6. 이용자 및 법정대리인의 권리와 행사 방법</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.</li>
              <li>회원 탈퇴를 통해 개인정보 수집 및 이용 동의를 철회할 수 있습니다.</li>
              <li>위 권리 행사는 회사에 서면, 이메일 등을 통해 할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">7. 쿠키의 사용</h2>
            <p>회사는 로그인 인증 및 서비스 이용을 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 제한이 있을 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">8. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>비밀번호 암호화 저장</li>
              <li>SSL/TLS를 통한 데이터 전송 암호화</li>
              <li>개인정보 접근 제한 및 관리</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">9. 개인정보 보호책임자</h2>
            <ul className="list-none space-y-1">
              <li><strong>상호:</strong> 밀포인트</li>
              <li><strong>이메일:</strong> sos1253@gmail.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-3">10. 개인정보 처리방침 변경</h2>
            <p>이 개인정보 처리방침은 2025년 3월 14일부터 적용됩니다. 변경 사항이 있을 경우 웹사이트를 통해 공지합니다.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border">
          <a href="/" className="text-primary hover:underline text-sm">&larr; 홈으로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
