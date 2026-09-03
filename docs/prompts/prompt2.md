New features:
	- Besides the credit card, I want to also add the debit account. 
		○ Meant to store savings account data.
		○ Doesn't have a payment or closing date, nor interest calculation
		○ Their transactions does have an operation number which makes easier for dupe detection (considering op number and date), other than that, incoming Excel files are identical
		○ There can be transfers between debit accounts, and payments from a debit account to a credit card. 
	- Add a feature: recurrent transactions
		○ These are known transactions that should happen within a month or a year
		○ Tied to either debit or credit
		○ Markable as done for the current iteration, either manually or automatic 
		○ Add a name and notes
		○ Once a transaction has been set, stop looking for this iteration for more matches.
		○ For the manual:
			§ Select a transaction to tie it to.
		○ For the automatic:
			§ With a defined currency 
			§ With an approximate amount, and range (for instance, setting up an aprox of 200, and a range of 100, that will allow it to match from 100 to 300)
			§ With a matchable string for the description 
			§ With an approximate date and a range (a day for monthly, and a date for yearly, and a range of days to consider before an after for the match)
			§ There should only be one for the iteration 
As for the plan:
	- About the entities:
		○ Cards should store:
			§ Name
			§ Current balance (the last calculated, for quick view)
			§ Cycle (or closing) day
			§ Payment day
	- To the transaction status, add PENDING, I can manually declare one to be pending if I know beforehand. 
		○ You can add this option to the contextual menu of each incoming transaction 
	- Make sure to specify, in a separate section (or file, up to you), to document all the logics and decision trees 
	
	
	
