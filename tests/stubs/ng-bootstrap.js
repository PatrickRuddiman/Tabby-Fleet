class NgbModal {
  open() {
    return {
      componentInstance: {},
      result: Promise.resolve(true),
    }
  }
}
class NgbModalRef {}
class NgbActiveModal {
  close() {}
  dismiss() {}
}
class NgbAccordionModule {}
class NgbModalModule {}

module.exports = {
  NgbModal,
  NgbModalRef,
  NgbActiveModal,
  NgbAccordionModule,
  NgbModalModule,
}
