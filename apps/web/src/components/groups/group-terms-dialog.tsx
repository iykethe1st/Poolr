'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GroupTermsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GroupTermsDialog({ open, onClose }: GroupTermsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Group Savings Circle Terms</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-5 text-sm text-muted-foreground">
            <Section title="1. Contribution Commitment">
              By creating or joining this group you commit to making your full contribution every cycle
              for the entire duration of the group. Missing a contribution affects every other member
              and may result in penalties.
            </Section>

            <Section title="2. Payout Schedule">
              Payouts are distributed to members in the agreed rotation order. Each member receives
              the full pooled amount exactly once. The payout order is set before the group starts
              and cannot be changed after.
            </Section>

            <Section title="3. Default &amp; Loss Sharing">
              If a member receives their payout and subsequently stops contributing, the shortfall
              is shared equally among all remaining active members.{' '}
              <strong className="text-foreground">
                Poolr cannot recover funds from defaulting members.
              </strong>{' '}
              You accept this risk by joining.
            </Section>

            <Section title="4. Default Protection Fund">
              Poolr holds a Default Protection Fund funded by a portion of platform fees. This fund
              may partially offset verified defaults at Poolr&apos;s discretion. It does{' '}
              <strong className="text-foreground">not</strong> guarantee full recovery of losses.
            </Section>

            <Section title="5. Late Payment Penalties">
              Contributions not received by the due date may incur a late penalty of 5% of the
              contribution amount, applied automatically where the group admin has enabled penalties.
              Repeated late payments may result in removal from the group.
            </Section>

            <Section title="6. Platform Fee">
              A platform fee is charged on every contribution you make. This fee is added to your
              contribution and is non-refundable. The exact amount is displayed before you confirm
              each payment.
            </Section>

            <Section title="7. No Early Withdrawal">
              Once a group has started, contributions cannot be refunded or withdrawn. You are
              committed for the full duration. You may only leave a group before it starts, subject
              to admin approval.
            </Section>

            <Section title="8. Your Responsibility">
              You are solely responsible for ensuring your payment method has sufficient funds on
              each due date. Insufficient funds do not excuse a missed contribution.
            </Section>

            <Section title="9. Dispute Resolution">
              Disputes between members are handled at Poolr&apos;s discretion. Poolr&apos;s decision
              on default determinations and fund disbursements is final.
            </Section>
          </div>
        </div>

        <Button className="w-full" onClick={onClose}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
