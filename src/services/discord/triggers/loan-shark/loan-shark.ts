import { findAllUnresolvedLoans } from '../../../../database/queries/loans.query.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { prepareLoanReminder } from '../../../loan.service.ts';
import { discordMessages } from '../../utils.ts';

export const loanShark = {
    interval: 86400,
    execute: async () => {
        const activeLoans = await findAllUnresolvedLoans();
        await Promise.all(
            activeLoans.map(async (reference) => {
                try {
                    const reminder = await prepareLoanReminder({ id: reference.id, userId: reference.userId });
                    if (!reminder) {
                        return;
                    }
                    const { loan, overdue } = reminder;
                    const amount = loan.amount + loan.amount * loan.interest;
                    const message = overdue
                        ? `Meeldetuletus: võlgned Suurele Muumile ${amount}, tagasimakse tähtaeg oli: ${loan.deadline}. Teie tulevaste panuste väljamaksetele rakendub lisalõiv.`
                        : `Meeldetuletus: võlgned Suurele Muumile ${amount}, tagasimakse tähtaeg on: ${loan.deadline} `;
                    await discordMessages.sendPrivateMessageToGambler(message, loan.userId);
                } catch (error) {
                    log(`LOAN SHARK: Failed to process loan ${reference.id}`, LoggerType.ERROR);
                    log(error, LoggerType.ERROR);
                }
            }),
        );
    },
};
