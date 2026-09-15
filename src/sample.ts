// Default diagram shown on first load. Standard Mermaid C4 syntax plus an
// `%% aquarius:` metadata block that positions the elements on two layers.
export const SAMPLE_C4 = `C4Context
    title System Context diagram for Internet Banking System

    Enterprise_Boundary(b0, "BankBoundary") {
        Person(customerA, "Personal Banking Customer", "A customer of the bank, with personal bank accounts.")
        System(bankingSystem, "Internet Banking System", "Allows customers to view information about their bank accounts and make payments.")
        System_Ext(mailSystem, "E-mail System", "The internal Microsoft Exchange e-mail system.")
        System_Ext(mainframe, "Mainframe Banking System", "Stores all of the core banking information about customers, accounts, transactions, etc.")
    }

    Rel(customerA, bankingSystem, "Uses")
    Rel(bankingSystem, mailSystem, "Sends e-mails", "SMTP")
    Rel(bankingSystem, mainframe, "Uses")
    Rel(mailSystem, customerA, "Sends e-mails to")

%% aquarius:layer id=actors name="Actors" visible=1 locked=0
%% aquarius:layer id=systems name="Systems" visible=1 locked=0
%% aquarius:node alias=customerA x=120 y=120 w=210 h=140 layer=actors
%% aquarius:node alias=bankingSystem x=520 y=120 w=215 h=130 layer=systems
%% aquarius:node alias=mailSystem x=520 y=360 w=215 h=130 layer=systems
%% aquarius:node alias=mainframe x=880 y=120 w=215 h=130 layer=systems
%% aquarius:boundary alias=b0 autofit=1 layer=systems
%% aquarius:rel from=customerA to=bankingSystem layer=actors
%% aquarius:rel from=bankingSystem to=mailSystem layer=systems
%% aquarius:rel from=bankingSystem to=mainframe layer=systems
%% aquarius:rel from=mailSystem to=customerA layer=actors
`;
