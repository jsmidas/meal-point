import { MessageCircle, MessagesSquare, Smartphone, Phone } from "lucide-react";

const contacts = [
  {
    icon: MessageCircle,
    title: "카카오톡 채널",
    desc: "밀포인트 공식 채널로 문의",
    href: "https://pf.kakao.com/CHANNEL_ID/chat",
    color: "bg-[#FEE500]/10 text-[#FEE500]",
  },
  {
    icon: MessagesSquare,
    title: "오픈채팅",
    desc: "카카오톡 오픈채팅방 입장",
    href: "https://open.kakao.com/o/ROOM_ID",
    color: "bg-[#FEE500]/10 text-[#FEE500]",
  },
  {
    icon: Smartphone,
    title: "문자 보내기",
    desc: "010-5678-1898",
    href: "sms:010-5678-1898",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Phone,
    title: "전화 걸기",
    desc: "010-5678-1898",
    href: "tel:010-5678-1898",
    color: "bg-primary/10 text-primary",
  },
];

export default function Contact() {
  return (
    <section id="contact" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm tracking-widest text-primary font-medium mb-3 uppercase">
            CONTACT
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            지금 바로 <span className="text-gradient">문의하세요</span>
          </h2>
          <p className="text-text-secondary">
            편한 방법으로 연락 주시면 빠르게 답변드리겠습니다.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {contacts.map((c) => (
            <a
              key={c.title}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="group rounded-2xl border border-border bg-bg-card p-6 text-center hover:border-border-light hover:bg-bg-card-hover transition-all"
            >
              <div
                className={`w-14 h-14 rounded-xl ${c.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}
              >
                <c.icon size={26} />
              </div>
              <h4 className="text-lg font-semibold text-text-primary mb-1">
                {c.title}
              </h4>
              <p className="text-sm text-text-secondary">{c.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
