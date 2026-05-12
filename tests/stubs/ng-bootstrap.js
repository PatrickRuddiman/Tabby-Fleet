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
class NgbModule {}

module.exports = {
  NgbModal,
  NgbModalRef,
  NgbActiveModal,
  NgbModule,
}
