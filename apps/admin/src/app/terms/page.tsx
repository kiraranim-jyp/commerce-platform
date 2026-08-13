import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export default function TermsPage() {
  return (
    <>
      <PageHeader title="이용약관" />
      <PageContainer size="lg">
        <Card padding="md" className="text-sm text-text-secondary">
          이용약관 페이지는 준비 중입니다.
        </Card>
      </PageContainer>
    </>
  );
}
