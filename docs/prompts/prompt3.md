Changes on main spec:
	- ExcelParserService: 
		- Have the column field names as constants on top of the service for easier control
	- RawImportRow: 
		○ Should be declared on the list of interfaces
		○ Have their variable names in English 
		○ Have extra fields for:
			§ Amounts converted to pen
	- Import Wizard
		○ Add a third step (final) after the user has completed the transaction review. This step should:
			§ Save the transactions
			§ Run the Recurrrent transaction validation on the current cycle's transactions
			§ Check storage
			§ Finalize the wizard
			§ Redirect the user to the conciliation page
