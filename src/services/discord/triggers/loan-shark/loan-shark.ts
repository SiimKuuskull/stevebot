import { map } from 'bluebird';
import { updateLateLoanBalance } from '../../../../database/queries/balance.query';
import { findAllUnresolvedLoans } from '../../../../database/queries/loans.query';
import { sendPrivateMessageToGambler } from '../../utils';

export const loanShark = {
    interval: 86400,
    execute: async () => {
        const activeLoans = await findAllUnresolvedLoans();
        await map(activeLoans, async (loan) => {
            const deadline = loan?.deadline.getTime();
            if (deadline > Date.now()) {
                sendPrivateMessageToGambler(
                    `Meeldetuletus: võlgned Suurele Muumile ${
                        loan.amount + loan.amount * loan.interest
                    }, tagasimakse tähtaeg on: ${loan.deadline} `,
                    loan.userId,
                );
            }
            if (deadline <= Date.now()) {
                await updateLateLoanBalance(loan.userId);
                sendPrivateMessageToGambler(
                    `Meeldetuletus: võlgned Suurele Muumile ${
                        loan.amount + loan.amount * loan.interest
                    }, tagasimakse tähtaeg oli: ${loan.deadline}. Teie järgmisel neljal võidul on väiksem kasum.`,
                    loan.userId,
                );
            }
        });
    },
};
