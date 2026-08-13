import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export default function PrivacySettingsPage() {
  return (
    <>
      <PageHeader title="개인정보 관리" />
      <PageContainer size="lg">
        <Card padding="md" className="text-sm text-text-secondary">
          개인정보 관리 페이지는 준비 중입니다.
        </Card>
      </PageContainer>
    </>
  );
}
