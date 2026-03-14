import { ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <span className="text-lg font-bold text-text-primary">밀포인트</span>
            <p className="text-sm text-text-secondary mt-1">발열용기 식단프로그램 식권발행기 등 solution 전문기업</p>
          </div>
          <div className="text-sm text-text-secondary space-y-1">
            <p>사업자등록번호: 803-53-00711</p>
            <p>대표: 손동엽 | 연락처: 010-5678-1898</p>
            <p>이메일: mealpoint@gmail.com</p>
          </div>
          <div>
            <a
              href="https://mealpoint.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors"
            >
              cafe24 스토어 <ExternalLink size={14} />
            </a>
          </div>
        </div>
        <div className="border-t border-border pt-6">
          <p className="text-xs text-text-muted text-center">
            &copy; {new Date().getFullYear()} 밀포인트. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
